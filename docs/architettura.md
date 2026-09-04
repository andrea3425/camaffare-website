# Come e' costruito il sito

Nota di architettura: stack, approccio, routing, rendering e i compromessi accettati.
Aggiornato al 5 settembre 2026.

In breve: **non e' una SPA** ed **e' volutamente privo di un template base**.

---

## Lo stack

Non c'e' uno stack, nel senso classico. Tre file HTML, un CSS, due JS.
**Zero dipendenze, zero build step, zero framework.** Non esiste un `package.json`,
non c'e' niente da compilare: i file che scrivi sono esattamente i byte che il
browser riceve.

L'unico "runtime" e' **nginx dentro un container Docker** che serve file statici
(`Dockerfile`), dietro il reverse proxy condiviso del VPS. In locale
`python3 -m http.server` fa lo stesso lavoro.

Peso totale trasferito: ~64 KB non compressi, di cui 37 KB sono i dati del menu.

| File              | Peso    |
| ----------------- | ------- |
| `index.html`      | 2,7 KB  |
| `menu.html`       | 3,3 KB  |
| `ordina.html`     | 5,0 KB  |
| `css/style.css`   | 14,1 KB |
| `js/app.js`       | 7,4 KB  |
| `js/menu-data.js` | 37,4 KB |

---

## L'approccio: MPA statico con un'isola dinamica

E' un **multi-page application**. Tre documenti indipendenti:

| Pagina        | Come nasce il contenuto                    |
| ------------- | ------------------------------------------ |
| `index.html`  | 100% HTML statico                          |
| `ordina.html` | 100% HTML statico                          |
| `menu.html`   | **guscio** statico + griglia costruita dal JS |

Le prime due sono HTML puro: il JS che caricano non fa assolutamente nulla
(vedi "Un solo app.js su tre pagine"). Solo il menu ha una parte generata a
runtime — un'unica "isola" dinamica dentro un sito altrimenti statico.

---

## Routing: non esiste, ed e' il punto

Non c'e' un router. Non c'e' `history.pushState`, non c'e' un match di URL,
non c'e' un componente `<Route>`.

**Il routing e' il filesystem.** Clicchi `<a href="menu.html">`, il browser fa una
richiesta HTTP, nginx cerca il file `menu.html` su disco e lo restituisce.
Navigazione = ricaricamento completo della pagina: nuovo documento, nuovo CSS
applicato (dalla cache), nuovo JS eseguito da zero. Lo stato precedente viene
buttato via.

Le uniche "rotte interne" sono le ancore delle categorie: `href="#cat-arancini"`
non carica niente, e' il browser che scorre a `<section id="cat-arancini">`.
Gestito nativamente, non da JS.

- **Cosa si ottiene**: back/forward, refresh, apri-in-nuova-scheda, condivisione
  dei link e deep-link funzionano gratis e correttamente.
- **Cosa si perde**: ogni navigazione e' un round trip e un ridisegno completo.

---

## Rendering: stringhe HTML, ricostruite da zero

Nel sorgente servito, il `<main>` di `menu.html` e' vuoto:

```html
<main class="menu-main wrap" id="menu-root">
  <!-- generato da js/app.js a partire da js/menu-data.js -->
</main>
```

Al caricamento, `js/app.js` legge i dati, costruisce una grossa stringa di HTML con
template literal e la assegna in un colpo solo a `root.innerHTML`. Nessun virtual
DOM, nessuna reattivita', nessun diffing: quando cambia qualcosa (una lettera nella
ricerca) **si ributta via tutto e si riscrive l'intera griglia**, 166 card comprese.

E' brutalmente semplice ed e' abbastanza veloce a queste dimensioni. Sarebbe la
scelta sbagliata con migliaia di elementi o con input dentro le card (perderebbero
il focus a ogni render).

Lo stato dell'app sono tre variabili in chiusura: `query` (testo cercato),
`attiva` (chip evidenziata), `bloccata` (barra congelata). Nient'altro.

**Escaping**: tutto cio' che finisce nell'HTML passa da `esc()`. Con dati scritti a
mano il rischio e' nullo, ma costruire HTML per concatenazione e' la strada maestra
per una XSS il giorno che i dati arrivassero da fuori.

---

## Come i dati raggiungono la pagina

`js/menu-data.js` **non e' un JSON**: e' un file JavaScript che in fondo fa

```js
window.CAMAFFARE_MENU = { CATEGORIE, PRODOTTI, TAG_LABEL };
```

Caricato con un normale `<script src>` prima di `app.js`, che se lo trova gia' in
memoria. Nessun `fetch`, nessun `import`, nessun modulo ES.

Scelta deliberata: un `fetch('menu.json')` avrebbe introdotto asincronia, un flash
di pagina vuota, e non funzionerebbe aprendo il file con doppio clic (`file://`
blocca le richieste per CORS). Cosi' invece il menu e' disponibile in modo sincrono
nell'istante in cui `app.js` parte.

Il costo: essendo JS e non dati, un errore di sintassi in quel file rompe la pagina
invece di dare un errore di parsing pulito. Per questo va sempre controllato con
`node --check js/menu-data.js` dopo averlo modificato.

---

## Un solo app.js su tre pagine

`app.js` e' incluso ovunque ma e' un IIFE che parte con:

```js
const root = document.getElementById('menu-root');
const chipsBox = document.getElementById('chips');
if (!root || !chipsBox || !window.CAMAFFARE_MENU) return;
```

Su home e ordina quegli elementi non esistono, quindi esce immediatamente. Un solo
file da tenere in cache invece di tre, al prezzo di ~7 KB inutili su due pagine.
E' il pattern piu' povero di "code splitting" che esista, ma su questa scala e' la
scelta giusta.

---

## Il template base che non c'e'

**Non esiste un layout condiviso.** Ogni pagina si ripete `<head>` completo, meta
tag, link ai font, appbar e tabbar. Tra `menu.html` e `ordina.html` ci sono
**37 righe identiche**.

E' il prezzo del "niente build step". Le alternative sarebbero un generatore statico
(Eleventy, Astro, Hugo) con partial e layout, oppure iniettare l'header via JS — ma
quest'ultima cosa peggiorerebbe tutto: sfarfallio all'avvio e header invisibile ai
crawler.

**In pratica**: se cambi una voce della tabbar o aggiungi un meta tag, devi farlo in
due o tre file. Con tre pagine e' sostenibile. Alla sesta o settima pagina, o quando
ti accorgi di aver dimenticato una modifica in un file, e' il momento di introdurre
un generatore statico.

---

## L'unico punto architetturale che merita attenzione

Il menu e' renderizzato dal client, quindi **nel sorgente HTML di `menu.html` non
c'e' nemmeno una delle 166 voci**. Google oggi esegue il JavaScript e quasi
certamente le indicizza, ma altri crawler no, e le anteprime dei link su WhatsApp o
Facebook non vedranno mai un piatto.

Se un domani interessa che "arancino al pistacchio Padova" porti gente sul sito, la
soluzione non e' cambiare approccio: basta uno script che prende `menu-data.js` e
**scrive dentro `menu.html`** l'HTML gia' pronto, da lanciare quando si aggiorna il
menu. Il sito resterebbe statico e il JS servirebbe solo per ricerca e chip.

Oggi non e' un problema — e' segnalato qui perche' e' la sola scelta di questa
architettura che sarebbe scomoda da correggere dopo.
