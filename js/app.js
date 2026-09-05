/* ============================================================
   CAMA'FFARE — script del sito
   Nessuna dipendenza. Si occupa di:
   - costruire la pagina menu a partire da js/menu-data.js
   - chip categorie = ancore: portano al gruppo, non filtrano
   - evidenziazione della chip della categoria che si sta guardando
   - ricerca (quella si', filtra)
   - placeholder automatico se la foto del prodotto non esiste
   - header nero quando si scrolla
   NB: per aggiornare il menu NON si tocca questo file, ma js/menu-data.js
   ============================================================ */

(() => {
  'use strict';

  const root = document.getElementById('menu-root');
  const chipsBox = document.getElementById('chips');
  if (!root || !chipsBox || !window.CAMAFFARE_MENU) return;

  const { CATEGORIE, PRODOTTI, TAG_LABEL } = window.CAMAFFARE_MENU;

  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const catById = new Map(CATEGORIE.map((c) => [c.id, c]));
  const stickyBar = document.getElementById('appbar-sticky');

  let query = '';

  /* normalizza per la ricerca (via accenti e maiuscole) */
  const norm = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
  }

  /* ---------- chip categorie: sono link a un gruppo della pagina ---------- */
  function renderChips() {
    chipsBox.innerHTML = CATEGORIE.map((c) => `
      <a class="chip" href="#cat-${c.id}" data-cat="${c.id}">
        <span class="chip__ico" aria-hidden="true">${c.icona}</span>${esc(c.nome)}
      </a>`).join('');
  }

  /* ---------- card prodotto ---------- */
  function cardHTML(p) {
    const cat = catById.get(p.categoria);
    const icona = cat ? cat.icona : '🍽️';
    const sfondo = cat && cat.colore ? cat.colore : '#f2f2f4';

    const tags = (p.tag || [])
      .map((t) => TAG_LABEL[t])
      .filter(Boolean)
      .map((t) => `<span class="tag ${t.classe}">${t.testo}</span>`)
      .join('');

    /* la foto viene rimossa dal DOM se il file non esiste: resta il placeholder */
    const img = p.foto
      ? `<img src="${p.foto}" alt="${esc(p.nome)}" loading="lazy" decoding="async"
              onerror="this.remove()">`
      : '';

    /* .item__open e' un bottone trasparente steso su tutta la card: rende
       cliccabile ogni punto e, essendo un vero <button>, si apre anche da
       tastiera. Un <button> non puo' contenere titoli e paragrafi, quindi sta
       sopra al contenuto invece di avvolgerlo. */
    /* il testo viene prima della foto anche nel DOM: e' quello che conta,
       per chi legge con uno screen reader come per chi guarda */
    return `
      <article class="item">
        <div class="item__body">
          <h3 class="item__name">${esc(p.nome)}</h3>
          ${p.descrizione ? `<p class="item__desc">${esc(p.descrizione)}</p>` : ''}
          <div class="item__foot">
            <p class="item__price">${euro.format(p.prezzo)}</p>
            ${tags ? `<div class="item__tags">${tags}</div>` : ''}
          </div>
        </div>
        <div class="item__media" style="background:${sfondo}">
          <span class="item__ph" aria-hidden="true">${icona}<small>foto in arrivo</small></span>
          ${img}
        </div>
        <button type="button" class="item__open" aria-label="Apri ${esc(p.nome)}"></button>
      </article>`;
  }

  /* ---------- griglia: sempre tutte le categorie, filtra solo la ricerca ---------- */
  function renderMenu() {
    const q = norm(query.trim());

    const filtrati = q
      ? PRODOTTI.filter((p) => norm(`${p.nome} ${p.descrizione || ''}`).includes(q))
      : PRODOTTI;

    const gruppi = CATEGORIE
      .map((c) => ({ cat: c, prodotti: filtrati.filter((p) => p.categoria === c.id) }))
      .filter((g) => g.prodotti.length);

    if (!gruppi.length) {
      root.innerHTML = `
        <p class="menu-empty">
          <span aria-hidden="true">\u{1F50D}</span>
          <strong>Niente da queste parti.</strong>
          Prova con un'altra parola.
        </p>`;
    } else {
      root.innerHTML = gruppi.map((g) => `
        <section class="menu-group" id="cat-${g.cat.id}">
          <header class="menu-group__head">
            <h2>${g.cat.icona} ${esc(g.cat.nome)}</h2>
            <span class="menu-group__count">${g.prodotti.length} ${g.prodotti.length === 1 ? 'voce' : 'voci'}</span>
          </header>
          <div class="grid">${g.prodotti.map(cardHTML).join('')}</div>
        </section>`).join('');
    }

    /* con la ricerca attiva certe categorie spariscono: nascondo le loro chip,
       altrimenti punterebbero a un gruppo che non c'e' piu' */
    chipsBox.querySelectorAll('.chip').forEach((a) => {
      a.classList.toggle('chip--off', !document.getElementById(`cat-${a.dataset.cat}`));
    });

    aggiornaChipAttiva();
  }

  /* ---------- evidenzia la chip della categoria che si sta guardando ---------- */
  let attiva = null;
  let bloccata = false;      // barra congelata durante uno scroll da clic
  let timerSblocco = null;
  let apriCategorie = null;  // valorizzata piu' sotto, se il browser ha <dialog>

  function segnaAttiva(id, centra) {
    if (id === attiva) return;
    attiva = id;
    chipsBox.querySelectorAll('.chip').forEach((a) => {
      const on = `cat-${a.dataset.cat}` === id;
      /* aria-current="" varrebbe "false" per lo standard: o 'true' o niente */
      if (on) {
        a.setAttribute('aria-current', 'true');
        /* solo la chip attiva apre l'elenco, e va dichiarato */
        if (apriCategorie) a.setAttribute('aria-haspopup', 'dialog');
        if (centra) a.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        a.removeAttribute('aria-current');
        a.removeAttribute('aria-haspopup');
      }
    });
  }

  function aggiornaChipAttiva() {
    const soglia = (stickyBar ? stickyBar.offsetHeight : 0) + 16;
    const gruppi = root.querySelectorAll('.menu-group');
    if (!gruppi.length) return;

    let corrente = gruppi[0].id;
    gruppi.forEach((g) => {
      if (g.getBoundingClientRect().top - soglia <= 0) corrente = g.id;
    });
    segnaAttiva(corrente, true);
  }

  /* Clic su una chip: la barra si congela sulla categoria scelta e resta ferma
     finche' la pagina non e' arrivata. Senza, l'evidenziazione passerebbe per
     tutte le categorie attraversate e la barra le rincorrerebbe una a una.
     Si sblocca quando lo scroll si ferma (150 ms di quiete). */
  function programmaSblocco() {
    clearTimeout(timerSblocco);
    timerSblocco = setTimeout(() => {
      bloccata = false;
      aggiornaChipAttiva();
    }, 150);
  }

  chipsBox.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    /* seconda toccata sulla categoria gia' scelta: con 22 categorie scorrere la
       barra e' scomodo, meglio aprirle tutte in un elenco */
    if (chip.hasAttribute('aria-current') && apriCategorie) {
      e.preventDefault();
      apriCategorie();
      return;
    }

    bloccata = true;
    segnaAttiva(`cat-${chip.dataset.cat}`, false);
    programmaSblocco();   // anche se la pagina non scrolla affatto
  });

  /* ---------- scroll: header nero + chip attiva (una sola passata) ---------- */
  let inCoda = false;

  function onScroll() {
    if (inCoda) return;
    inCoda = true;
    requestAnimationFrame(() => {
      inCoda = false;
      if (stickyBar) stickyBar.classList.toggle('is-stuck', window.scrollY > 4);
      if (bloccata) { programmaSblocco(); return; }
      aggiornaChipAttiva();
    });
  }

  /* altezza dell'header, serve a CSS per lo scroll-margin dei gruppi:
     senza, l'ancora finirebbe sotto la barra fissa */
  function misuraHeader() {
    if (!stickyBar) return;
    document.documentElement.style.setProperty('--stick-h', `${stickyBar.offsetHeight}px`);
  }

  /* ---------- ricerca ---------- */
  const input = document.getElementById('menu-search');
  const clearBtn = document.getElementById('search-clear');

  if (input) {
    input.addEventListener('input', () => {
      query = input.value;
      if (clearBtn) clearBtn.hidden = query === '';
      renderMenu();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      query = '';
      clearBtn.hidden = true;
      input.focus();
      renderMenu();
    });
  }

  /* ---------- scheda del prodotto ---------- */
  const scheda = document.getElementById('prodotto-modal');

  if (scheda && typeof scheda.showModal === 'function') {
    const sImg  = scheda.querySelector('.scheda__img');
    const sPh   = scheda.querySelector('.scheda__ph');
    const sTags = scheda.querySelector('.scheda__tags');
    const sTit  = scheda.querySelector('.scheda__title');
    const sDes  = scheda.querySelector('.scheda__desc');
    const sPre  = scheda.querySelector('.scheda__price');
    const testo = (el) => (el ? el.textContent.trim() : '');

    root.addEventListener('click', (e) => {
      const card = e.target.closest('.item');
      if (!card) return;

      const media = card.querySelector('.item__media');
      const img = media.querySelector('img');

      if (img) {
        sImg.src = img.currentSrc || img.src;
        sImg.alt = img.alt;
        sImg.hidden = false;
        sPh.hidden = true;
      } else {
        /* senza foto si riprende il placeholder della card: stessa icona,
           stesso colore di categoria, cosi' la scheda resta riconoscibile */
        const ph = media.querySelector('.item__ph');
        sPh.textContent = ph && ph.firstChild ? ph.firstChild.textContent.trim() : '';
        sPh.style.background = media.style.background;
        sPh.hidden = false;
        sImg.hidden = true;
        sImg.removeAttribute('src');
      }

      const tags = card.querySelector('.item__tags');
      sTags.innerHTML = tags ? tags.innerHTML : '';
      sTags.hidden = !tags;

      sTit.textContent = testo(card.querySelector('.item__name'));
      sDes.textContent = testo(card.querySelector('.item__desc'));
      sDes.hidden = sDes.textContent === '';
      sPre.textContent = testo(card.querySelector('.item__price'));

      document.documentElement.classList.add('has-modal');
      scheda.showModal();
    });

    scheda.addEventListener('click', (e) => {
      if (!e.target.closest('.scheda__fig')) scheda.close();
    });
    scheda.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => scheda.close());
    });
    scheda.addEventListener('close', () => {
      document.documentElement.classList.remove('has-modal');
      sImg.removeAttribute('src');   // libera la memoria della foto grande
    });
  }

  /* ---------- elenco di tutte le categorie ---------- */
  const catModal = document.getElementById('cat-modal');

  if (catModal && typeof catModal.showModal === 'function') {
    const lista = catModal.querySelector('.catlist');

    apriCategorie = () => {
      /* solo le categorie che in questo momento hanno un gruppo in pagina: durante
         una ricerca le altre non ci sono e il salto non porterebbe da nessuna parte */
      lista.innerHTML = CATEGORIE
        .map((c) => ({ c, gruppo: document.getElementById(`cat-${c.id}`) }))
        .filter((x) => x.gruppo)
        .map(({ c, gruppo }) => `
          <a class="catlist__item" href="#cat-${c.id}" data-cat="${c.id}"
             ${`cat-${c.id}` === attiva ? 'aria-current="true"' : ''}>
            <span class="catlist__ico" aria-hidden="true">${c.icona}</span>
            <span class="catlist__nome">${esc(c.nome)}</span>
            <span class="catlist__n">${gruppo.querySelectorAll('.item').length}</span>
          </a>`).join('');

      document.documentElement.classList.add('has-modal');
      catModal.showModal();
    };

    const tasto = document.getElementById('chips-all');
    if (tasto) tasto.addEventListener('click', apriCategorie);

    lista.addEventListener('click', (e) => {
      const voce = e.target.closest('.catlist__item');
      if (!voce) return;
      e.preventDefault();
      catModal.close();

      /* stessa logica del clic su una chip: la barra si congela sulla categoria
         scelta finche' la pagina non e' arrivata */
      bloccata = true;
      segnaAttiva(`cat-${voce.dataset.cat}`, true);
      programmaSblocco();

      const gruppo = document.getElementById(`cat-${voce.dataset.cat}`);
      if (gruppo) gruppo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    catModal.addEventListener('click', (e) => {
      if (!e.target.closest('.modal__box')) catModal.close();
    });
    catModal.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => catModal.close());
    });
    catModal.addEventListener('close', () => {
      document.documentElement.classList.remove('has-modal');
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', misuraHeader);

  renderChips();
  renderMenu();
  misuraHeader();
  onScroll();
})();


/* ============================================================
   ORDINA — la riga dell'app apre la scelta dello store
   Se <dialog> non e' supportato o questo script non parte, il link
   continua a portare a linktr.ee: niente vicolo cieco.
   ============================================================ */
(() => {
  'use strict';

  const apri = document.getElementById('app-opt');
  const modal = document.getElementById('app-modal');
  if (!apri || !modal || typeof modal.showModal !== 'function') return;

  apri.addEventListener('click', (e) => {
    e.preventDefault();
    modal.showModal();
  });

  /* clic fuori dal riquadro = chiudi (il backdrop ha come bersaglio il dialog) */
  modal.addEventListener('click', (e) => {
    if (!e.target.closest('.modal__box')) modal.close();
  });

  modal.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => modal.close());
  });

  /* con il modale aperto la pagina dietro non deve scorrere */
  const bloccaSfondo = (on) => document.documentElement.classList.toggle('has-modal', on);
  modal.addEventListener('close', () => bloccaSfondo(false));
  apri.addEventListener('click', () => bloccaSfondo(true));
})();
