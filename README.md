# camaffare.it

Sito vetrina statico per **Cama'ffare**, rosticceria e pizzeria siciliana a Padova.
Stile ispirato alle app di food delivery, ma **non si ordina dal sito**: qui si esplora
il menu, poi si ordina dai canali ufficiali.

Niente framework, niente build: tre pagine HTML, un CSS, due JS.

Come e' costruito (stack, routing, rendering e compromessi):
[docs/architettura.md](docs/architettura.md).

## Struttura

```
index.html        home — sfondo rosso, logo bianco, due pulsanti (Scopri il menu / Ordina ora)
menu.html         menu — categorie in alto, ricerca, griglia con foto/nome/descrizione/prezzo
ordina.html       ordina — pulsanti in colonna: app, Just Eat, Glovo, Deliveroo, telefono

js/menu-data.js   ⭐ DEFINIZIONE DEL MENU — l'unico file da toccare per aggiornare i piatti
js/app.js         rendering del menu, filtri categoria, ricerca, ombra dell'appbar
css/style.css     stili di tutto il sito

menu/             📷 foto dei prodotti (vedi menu/README.md)
public/logo/      loghi — vedi tabella sotto
```

## Loghi

| File                          | Formato | Dove si usa                                |
| ----------------------------- | ------- | ------------------------------------------ |
| `logo_red_squared_180.png`    | 180×180 | favicon e icona home di iOS (tutte le pagine) |
| `logo_white_360.png`          | 360×131 | logo grande sul rosso della home           |
| `logo_red_180.png`            | 180×64  | header di `menu.html` e `ordina.html`      |
| `logo_white_squared_180.png`  | 180×180 | riquadro "App Cama'ffare" in `ordina.html` |
| `logo_white_180.png`          | 180×66  | non usato al momento                       |
| `logo_red_360.png`            | 360×130 | non usato al momento                       |

## Aggiornare il menu

Il menu reale del negozio (166 voci, 22 categorie) e' gia' dentro `js/menu-data.js`.
Per aggiornarlo si modifica **solo quel file**. In cima al file ci sono le istruzioni.
In breve, una voce di menu e' cosi':

```js
{ id: 'arancino-ragu',
  categoria: 'arancini',            // deve esistere in CATEGORIE
  nome: 'Arancino al ragù',
  descrizione: 'Riso, ragù di carne e piselli.',
  prezzo: 3.00,                     // numero, punto decimale, senza €
  foto: 'menu/arancino-ragu.jpg',   // opzionale
  tag: ['piccante'] },              // opzionale: vegetariano | vegano | piccante | novita
```

Categorie e ordine dei filtri si cambiano nell'array `CATEGORIE` dello stesso file.

## Foto dei prodotti

Vanno nella cartella [`menu/`](menu/) — quadrate, ~800×800, jpg, max ~200 KB.
Il nome del file deve combaciare con il campo `foto` della voce.
**Se la foto manca, la card mostra un placeholder colorato**: nessuna immagine rotta,
nessuna modifica al codice quando poi la si carica.

## Ancora da definire

- Nomi delle voci di "Milingiana friuta" e "I patat": nel menu del negozio non ne hanno
  uno, sono numerate (Milingiana 1, I patat 1...) con gli ingredienti in descrizione.
- Tag `vegetariano`: nessuna voce ne ha uno, va deciso piatto per piatto.
- Le foto dei prodotti in [`menu/`](menu/): 166 voci, tutte con placeholder.
- Orari di apertura (non ancora presenti sul sito).
- P.IVA nel footer.
- Link diretti App Store / Play Store dell'app Cama'ffare (ora puntano al Linktree).
- `public/og-image.jpg` (1200×630) per l'anteprima social.

## Sviluppo locale

```bash
python3 -m http.server 8000     # poi apri http://localhost:8000
```

(Aprire `index.html` col doppio click funziona, ma un server statico e' piu' fedele.)

## Deploy

Container nginx dietro un reverse proxy condiviso (nginx-proxy + acme-companion)
definito in un repo infra separato, dato che il VPS ospita piu' siti.

- Questo repo produce solo un'immagine Docker statica (`Dockerfile`), porta 80.
- `docker-compose.yml` collega il container alla rete Docker esterna `proxy` e imposta
  `VIRTUAL_HOST`/`LETSENCRYPT_HOST` cosi' il proxy scopre il sito e chiede il certificato.

Prerequisiti sul VPS al primo deploy:
1. DNS di camaffare.it (e www) puntato all'IP del VPS.
2. Rete Docker esterna `proxy` creata (dal repo infra).
3. Repo infra con nginx-proxy + acme-companion in esecuzione.

Poi: `docker compose up -d --build`.
