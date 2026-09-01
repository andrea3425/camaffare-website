# Note su CI/CD e deploy

Appunti dalla discussione su come automatizzare il deploy di camaffare_website sul VPS.

## L'idea di base

Invece di fare il deploy a mano ogni volta (login sul VPS, `git pull`, `docker compose up -d --build`), una **GitHub Action** può farlo automaticamente ad ogni push sul branch principale.

## Approccio consigliato: SSH diretto

La Action, a fine push:
1. Si collega via SSH al VPS (con una chiave dedicata, non quella personale, salvata come GitHub Secret).
2. Esegue `git pull && docker compose up -d --build` direttamente nella cartella del progetto sul VPS.

Vantaggi: semplice, nessun componente extra da mantenere (niente registry, niente server in ascolto). Adatto a un sito statico come questo.

Attenzione: la chiave SSH deve avere accesso limitato (solo a quella cartella/comando se possibile) e va tenuta solo nei GitHub Secrets, mai nel codice.

## Approccio alternativo: registry + pull automatico

Più adatto a progetti più grandi o con più ambienti. Pezzi coinvolti:

- **GHCR (GitHub Container Registry)** — `ghcr.io`, il registro Docker di GitHub. La CI builda l'immagine e la carica lì (equivalente a Docker Hub, ma autenticazione automatica con `GITHUB_TOKEN`, senza credenziali extra da gestire).
- **Docker Hub** — alternativa più "universale" a GHCR, ma richiede un account e un token separati, e sul piano gratuito ha limiti di pull piuttosto bassi.
- **Watchtower** — un container che gira sul VPS e controlla periodicamente se sul registry è comparsa una nuova versione dell'immagine; se sì, la scarica e riavvia il container da solo (poller automatico, nessuna notifica esterna).
- **Webhook** — notifica **HTTP POST** che un servizio manda a un altro quando succede qualcosa (es. GitHub che avvisa il VPS "nuova immagine pronta" appena finita la build, invece di aspettare il prossimo controllo di Watchtower). Per riceverlo serve un piccolo server sempre attivo sul VPS in ascolto su una porta, che verifichi l'autenticità della richiesta (firma/secret condiviso) ed esegua il pull — un componente in più da scrivere, mettere in sicurezza e mantenere.

Schema: build → **GHCR** (deposito immagine) → **Watchtower** (controllo periodico) *oppure* **webhook** (notifica immediata).

## Conclusione

Per questo progetto (sito statico, VPS singolo): approccio SSH diretto, senza registry né server aggiuntivi.
