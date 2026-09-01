# camaffare.it

Sito vetrina statico per Camaffare, rosticceria e pizzeria siciliana a Padova.

Attualmente in fase di scaffolding: la home page mostra solo "sito in costruzione",
i contenuti verranno aggiunti in seguito.

## Struttura

```
index.html      pagina statica (per ora solo "sito in costruzione")
css/style.css   stili
js/app.js       script di base (anno nel footer)
public/         loghi e favicon
gallery/        immagini della galleria
```

## Sviluppo locale

Basta aprire `index.html` in un browser, oppure servirlo con un server statico qualsiasi
(es. `npx serve .` o `python3 -m http.server`).

## Deploy

Il sito e' pensato per girare come container nginx dietro un reverse proxy condiviso
(nginx-proxy + acme-companion) definito in un repo infra separato, dato che il VPS
ospitera' piu' siti.

- Questo repo produce solo un'immagine Docker statica (`Dockerfile`) che espone la porta 80.
- `docker-compose.yml` collega il container alla rete Docker esterna `proxy`, creata dal
  repo infra, e imposta `VIRTUAL_HOST`/`LETSENCRYPT_HOST` cosi' il reverse proxy scopre
  automaticamente il sito e richiede il certificato Let's Encrypt.

Prerequisiti sul VPS prima del primo deploy:
1. DNS di camaffare.it (e www) puntato all'IP del VPS.
2. Rete Docker esterna `proxy` creata (dal repo infra).
3. Repo infra con nginx-proxy + acme-companion gia' in esecuzione.

Poi qui basta: `docker compose up -d --build`.
