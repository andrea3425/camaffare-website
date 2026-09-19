#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scarica_foto_menu.py
====================
Legge menu_product_image_urls.csv e scarica tutte le foto dei prodotti
nel formato richiesto da menu.js:

    menu/<id>.jpg     quadrata, 800x800 px, JPEG, ~200 KB max

Il nome del file viene dalla colonna `id` del CSV, che e' lo stesso id
usato in menu.js: quindi la foto finisce esattamente dove il campo
`foto: 'menu/<id>.jpg'` la sta cercando.

Le righe con image_url vuoto vengono saltate (il sito mostrera' il
placeholder colorato della categoria).

------------------------------------------------------------------
USO
------------------------------------------------------------------
    pip install requests pillow

    python scarica_foto_menu.py
    python scarica_foto_menu.py --dry-run          # non scarica, mostra cosa farebbe
    python scarica_foto_menu.py --force            # riscarica anche le foto gia' presenti
    python scarica_foto_menu.py --solo pizze-solite arancini
    python scarica_foto_menu.py --size 1000 --max-kb 300

Di default lo script cerca il CSV nella stessa cartella e scrive in ./menu/
"""

import argparse
import csv
import io
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
except ImportError:
    sys.exit("Manca la libreria requests.  Installala con:  pip install requests")

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Manca la libreria Pillow.  Installala con:  pip install pillow")


UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " \
     "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"


# ------------------------------------------------------------------
# URL
# ------------------------------------------------------------------
def prepara_url(url, size):
    """Gli URL del CDN contengono i segnaposto {w} e {h}: li sostituisce
    con la dimensione richiesta, altrimenti l'immagine non carica."""
    return (url.replace("{w}", str(size))
               .replace("{h}", str(size))
               .replace("%7Bw%7D", str(size))
               .replace("%7Bh%7D", str(size)))


def scarica_bytes(url, tentativi=3, timeout=30):
    ultimo_errore = None
    for n in range(tentativi):
        try:
            r = requests.get(url, timeout=timeout, headers={"User-Agent": UA})
            r.raise_for_status()
            if not r.content:
                raise ValueError("risposta vuota")
            return r.content
        except Exception as e:          # rete instabile / rate limit
            ultimo_errore = e
            if n < tentativi - 1:
                time.sleep(1.5 * (n + 1))
    raise ultimo_errore


# ------------------------------------------------------------------
# Immagine
# ------------------------------------------------------------------
def elabora(dati, size, max_kb, qualita_max=88, qualita_min=55):
    """Ritaglia al centro in quadrato, ridimensiona a size x size,
    salva in JPEG abbassando la qualita' finche' sta sotto max_kb."""
    img = Image.open(io.BytesIO(dati))
    img = ImageOps.exif_transpose(img)           # raddrizza se ha rotazione EXIF

    if img.mode in ("RGBA", "LA", "P"):          # via la trasparenza: il JPEG non ce l'ha
        sfondo = Image.new("RGB", img.size, (255, 255, 255))
        img = img.convert("RGBA")
        sfondo.paste(img, mask=img.split()[-1])
        img = sfondo
    else:
        img = img.convert("RGB")

    # ritaglio centrale quadrato + resize (ImageOps.fit fa entrambe le cose)
    img = ImageOps.fit(img, (size, size), method=Image.LANCZOS, centering=(0.5, 0.5))

    limite = max_kb * 1024
    for q in range(qualita_max, qualita_min - 1, -6):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= limite:
            return buf.getvalue(), q
    return buf.getvalue(), q                     # ultima versione, anche se sfora


# ------------------------------------------------------------------
# Una riga
# ------------------------------------------------------------------
def lavora_riga(riga, args):
    pid = (riga.get("id") or "").strip()
    nome = (riga.get("product") or "").strip()
    cat = (riga.get("categoria") or "").strip()
    url = (riga.get("image_url") or "").strip()

    if not pid:
        return ("errore", nome, "riga senza id")
    if args.solo and cat not in args.solo:
        return ("filtrata", pid, "")
    if not url:
        return ("saltata", pid, "nessun URL nel CSV")

    dest = os.path.join(args.out, pid + ".jpg")
    if os.path.exists(dest) and not args.force:
        return ("gia-presente", pid, "")

    if args.dry_run:
        return ("dry-run", pid, prepara_url(url, args.size))

    try:
        dati = scarica_bytes(prepara_url(url, args.size))
        jpg, q = elabora(dati, args.size, args.max_kb)
        tmp = dest + ".part"
        with open(tmp, "wb") as f:
            f.write(jpg)
        os.replace(tmp, dest)                    # scrittura atomica
        return ("ok", pid, "%d KB, q=%d" % (len(jpg) // 1024, q))
    except Exception as e:
        return ("errore", pid, "%s: %s" % (type(e).__name__, e))


# ------------------------------------------------------------------
def main():
    qui = os.path.dirname(os.path.abspath(__file__))
    p = argparse.ArgumentParser(description="Scarica le foto del menu Cama'ffare.")
    p.add_argument("--csv", default=os.path.join(qui, "menu_product_image_urls.csv"),
                   help="file CSV di partenza")
    p.add_argument("--out", default=os.path.join(qui, "menu"),
                   help="cartella di destinazione (default: ./menu)")
    p.add_argument("--size", type=int, default=800, help="lato in px (default 800)")
    p.add_argument("--max-kb", type=int, default=200, help="peso massimo in KB (default 200)")
    p.add_argument("--workers", type=int, default=6, help="download in parallelo (default 6)")
    p.add_argument("--force", action="store_true", help="riscarica anche i file gia' presenti")
    p.add_argument("--dry-run", action="store_true", help="non scarica niente, mostra solo")
    p.add_argument("--solo", nargs="+", metavar="CATEGORIA",
                   help="scarica solo queste categorie (es. --solo arancini birre)")
    args = p.parse_args()

    if not os.path.exists(args.csv):
        sys.exit("CSV non trovato: %s" % args.csv)
    if not args.dry_run:
        os.makedirs(args.out, exist_ok=True)

    with open(args.csv, encoding="utf-8-sig", newline="") as f:
        righe = list(csv.DictReader(f))

    attese = {"id", "product", "image_url"}
    if not attese.issubset(set(righe[0].keys() if righe else [])):
        sys.exit("Il CSV deve avere le colonne: id, categoria, product, image_url")

    print("CSV: %s  (%d righe)" % (args.csv, len(righe)))
    print("Destinazione: %s   %dx%d px, JPEG, max %d KB\n"
          % (args.out, args.size, args.size, args.max_kb))

    conteggi = {}
    errori = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futuri = {pool.submit(lavora_riga, r, args): r for r in righe}
        for fut in as_completed(futuri):
            stato, pid, info = fut.result()
            conteggi[stato] = conteggi.get(stato, 0) + 1
            if stato == "filtrata":
                continue
            simbolo = {"ok": "OK      ", "gia-presente": "gia' c'e'",
                       "saltata": "salto   ", "dry-run": "dry-run ",
                       "errore": "ERRORE  "}[stato]
            print("  %s %-45s %s" % (simbolo, pid + ".jpg", info))
            if stato == "errore":
                errori.append((pid, info))

    print("\n" + "-" * 60)
    for k in ("ok", "gia-presente", "saltata", "dry-run", "errore", "filtrata"):
        if conteggi.get(k):
            print("  %-14s %d" % (k, conteggi[k]))

    if errori:
        print("\nDa riprovare (rilancia lo script: i file gia' scaricati vengono saltati):")
        for pid, info in errori:
            print("  %-40s %s" % (pid, info))
        sys.exit(1)


if __name__ == "__main__":
    main()
