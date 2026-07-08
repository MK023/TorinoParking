# Code Review, Debug & Security Review — 6 luglio 2026

Review completa di backend (FastAPI) e frontend (React + Capacitor) su `main` (`fd6e5ea`),
condotta con: knowledge graph **graphify** per la mappa architetturale, skill di security
review per la metodologia, esecuzione test suite, lint/typecheck, audit dipendenze
(pip-audit, npm audit).

## Executive summary

**Stato generale: buono.** L'architettura a layer (api / domain / infrastructure) è pulita,
le difese fondamentali ci sono e funzionano: parser XML protetto da XXE con defusedxml,
API key con HMAC-SHA256 e confronto constant-time, SQL interamente parametrizzato,
rate limiting sliding-window su Redis, security headers + CSP, ProxyHeaders con trusted
hosts, validazione dei secret in produzione, container non-root, Postgres/Redis bindati
su 127.0.0.1. Il frontend è privo di sink XSS (tutto JSX escaped; negli `html:` dei
divIcon Leaflet vanno solo numeri e colori generati internamente).

**Nessuna vulnerabilità HIGH trovata.** I finding sono medium/low di difesa in
profondità, più alcuni bug di qualità/robustezza e 3 advisory di dipendenze con fix
disponibile.

**Test: 77/77 passano** (dopo il fix ambiente descritto sotto). Ruff pulito, tsc pulito,
ESLint con 3 errori.

---

## 1. Debug — problemi trovati durante l'esecuzione

### 1.1 Cinque test falliti → ambiente locale disallineato (risolto)
`tests/unit/test_five_t_client.py` (3 test), `tests/integration/test_filters.py`,
`tests/e2e/test_fetch_flow.py` fallivano con `RESPX: … not mocked!`.
**Root cause:** nell'ambiente pyenv era installato `respx 0.21.0`, incompatibile con
`httpx 0.28`; `requirements-dev.txt` pinna correttamente `respx==0.22.0`.
**Fix applicato:** `pip install respx==0.22.0` → **77/77 passano in 7.4s**.
Il codice era corretto; era l'ambiente a non rispettare i pin.

### 1.2 Socket Docker rotto sulla macchina (workaround)
`/var/run/docker.sock` è un symlink a `/Users/monferrina/.docker/run/docker.sock`
(utente diverso, path inesistente). La CLI docker funziona (usa il context), ma
docker-py/testcontainers no.
**Workaround usato:** `DOCKER_HOST=unix:///Users/marcobellingeri/.docker/run/docker.sock`.
**Fix permanente consigliato:** in Docker Desktop → Settings → Advanced, riabilitare
"Allow the default Docker socket to be used", oppure esportare `DOCKER_HOST` in `~/.zshrc`.

### 1.3 conftest.py avvia testcontainers anche per i soli unit test
`pytest_configure` in `tests/conftest.py:23` avvia sempre Postgres+Redis, anche per
`pytest tests/unit` che in gran parte non tocca il DB. Costo: ~10s e dipendenza da Docker
per test puri. Suggerimento: avvio lazy dei container (solo se la sessione raccoglie test
marcati `integration`/`e2e`).

---

## 2. Security review

### 2.1 Cosa è già solido (verificato)

| Area | Evidenza |
|---|---|
| XXE / XML bomb | `defusedxml.minidom.parseString` valida prima di `xmltodict` (`app/infrastructure/parser.py:39`) |
| API key storage | HMAC-SHA256 con salt, raw key mai persistita (`api_key_service.py:19`) |
| Admin auth | `hmac.compare_digest`, rifiuto se key vuota (`admin.py:21-23`) |
| SQL injection | Solo statement parametrizzati/ORM; i due `text()` in `scheduler.py` non hanno input utente |
| IP spoofing | `ProxyHeadersMiddleware` con `trusted_hosts` configurabile (`main.py:95-98`) |
| Secrets in prod | Validator Pydantic rifiuta admin key <32 char e salt <16 char fuori da dev/test (`config.py:72-81`) |
| Headers | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy |
| Frontend XSS | Nessun uso di API raw-HTML di React o `innerHTML`; popup Leaflet in JSX (auto-escaped); negli `html:` dei divIcon solo valori interni non user-controlled |
| Docker | User non-root, healthcheck, DB/Redis esposti solo su 127.0.0.1, `.env` gitignored |

### 2.2 Finding

**M1 — Admin API raggiungibile da internet con sola static key.**
Caddy inoltra tutto `/api/*` al backend, inclusi gli endpoint `/api/v1/admin/*`. La
protezione è un solo header statico (`X-Admin-Key`) + rate limit 30/min per IP. Con key
≥32 char il brute force è infeasible, ma per difesa in profondità: limitare le route
admin a livello Caddy (IP allowlist o rimozione del path dal reverse proxy pubblico),
tenendole raggiungibili solo dalla rete interna. *File: `Caddyfile`, `app/api/routes/admin.py`.*

**M2 — Rate limiter fail-open su errore Redis.**
Se Redis è giù, `RateLimitMiddleware` logga e lascia passare tutto
(`middleware.py:97-99`). Scelta deliberata (availability > throttling) e in sé
ragionevole, ma con Redis giù anche la cache è giù: ogni richiesta anonima su
`/api/v1/parkings` in cache-miss innesca una fetch verso l'API 5T senza alcun freno.
Suggerimento: in caso di errore Redis, applicare un fallback in-memory molto grossolano
(anche solo un contatore per processo) o quantomeno monitorare l'evento.

**M3 — Compose unico con `--reload`, bind-mount dei sorgenti e Dockhand con docker.sock.**
`docker-compose.yml` è di fatto un compose di sviluppo (uvicorn `--reload`, mount di
`app/`, `tests/`, `DEBUG` che abilita `/docs`): se riusato tale e quale in produzione
diventa una superficie di rischio. Dockhand monta `/var/run/docker.sock`
(root-equivalent): ok come dev tool dietro profilo `tools` e porta localhost, ma non deve
mai arrivare su un host esposto. Suggerimento: `docker-compose.prod.yml` separato senza
reload, senza mount dei sorgenti, senza Dockhand.

**L1 — Credenziali di default nel codice di config.**
`config.py` ha default `postgresql+asyncpg://parking:parking@…` e
`redis://:changeme@…`. Il validator di produzione impone forza solo ad `ADMIN_API_KEY` e
`HMAC_SALT`, non a `DATABASE_URL`/`REDIS_URL`. Rischio basso (Doppler li inietta), ma il
validator potrebbe rifiutare anche i default noti fuori da dev/test.

**L2 — Semantica ETag imprecisa con filtri.**
`GET /api/v1/parkings?available=true` risponde con l'ETag del dataset *non filtrato*
(`parkings.py:73-93`), e il confronto `if_none_match.strip('"')` non gestisce weak
validator (`W/"…"`) né liste di ETag. Con i browser (cache per-URL) non è sfruttabile,
ma client custom possono ottenere 304 per rappresentazioni diverse. Fix semplice:
includere i parametri di filtro nel calcolo dell'ETag o emettere l'ETag solo sulla
richiesta senza filtri.

**L3 — `allowedHosts: true` nel dev server Vite.**
`frontend/vite.config.ts` disabilita la protezione DNS-rebinding del dev server (serve
per il test via ngrok). Solo dev, ma meglio restringere al dominio ngrok effettivo
(`allowedHosts: [".ngrok-free.app"]`).

**L4 — Token Mapbox nel bundle.**
Normale per i token pubblici `pk.*`, ma prima della release App Store va configurata la
**URL restriction** del token nella dashboard Mapbox, altrimenti chiunque lo estrae dal
bundle può consumare la quota.

**L5 — GDPR / privacy log.**
`AccessLogMiddleware` logga l'IP client su file con rotazione (50MB totali). Gli IP sono
dati personali: per l'App Store e il GDPR va dichiarato nella privacy policy, oppure si
può troncare l'ultimo ottetto nel log.

### 2.3 Audit dipendenze

| Ecosistema | Pacchetto | Advisory | Fix |
|---|---|---|---|
| Python | pydantic-settings 2.13.1 | GHSA-4xgf-cpjx-pc3j | → 2.14.2 |
| npm (transitive) | brace-expansion | GHSA-jxxr-4gwj-5jf2 (moderate) | `npm audit fix` |
| npm (transitive) | tar ≤7.5.15 | GHSA-vmf3-w455-68vh (moderate) | `npm audit fix` |

Le due npm sono in tooling transitive (glob/tar), non nel bundle runtime.

---

## 3. Code review — qualità

**Q1 — Dead code in `db_repository.py`.**
`upsert_parking_metadata` (`db_repository.py:24`) e `store_snapshots`
(`db_repository.py:52`) non hanno alcun chiamante: `scheduler.fetch_parking_data`
reimplementa upsert e insert inline. O lo scheduler usa il repository (preferibile:
un'unica implementazione, testabile), o i due metodi vanno rimossi.

**Q2 — Boost refresh che non decade (`useParkings.ts:127-136`).**
`boostRefresh` imposta l'intervallo a 30s e un timeout che dopo 5 minuti torna a 2
minuti. Ma se nel frattempo l'effect principale ri-esegue (cambio filtri, visibility),
il cleanup cancella quel timeout; l'effect ricrea l'intervallo a 30s (il boost è ancora
attivo) e **nessuno lo riporterà più a 2 minuti** fino al prossimo re-render dell'effect.
Risultato: polling a 30s indefinito → carico inutile su backend e batteria iOS.
Fix: gestire il decadimento dentro un unico posto (es. `setTimeout` ricorsivo che
consulta `getRefreshInterval()` a ogni tick, o ricontrollare il boost dentro il callback
dell'interval).

**Q3 — ESLint: 3 errori.**
- `App.tsx:61` e `ParkingDetail.tsx:80`: `setState` sincrono dentro `useEffect`
  (`react-hooks/set-state-in-effect`) — cascading render; in `ParkingDetail` basta
  inizializzare `loadingHistory` a `true` o derivare lo stato.
- `POILayer.tsx:115`: `getNearestParkings` esportata da un file componente rompe il fast
  refresh — spostarla in `utils/parking.ts`.

**Q4 — `alert()` per errori geolocalizzazione (`App.tsx:69,88`).**
Su iOS nativa l'alert di sistema è brusco e non stilizzato; prima della release
sostituire con un toast/banner in-app (già esiste il pattern `OfflineBanner`).

**Q5 — Membro non univoco nel rate limiter (`rate_limiter.py:32`).**
Due richieste nello stesso `time.time()` float producono lo stesso member nel sorted set
(zadd sovrascrive) → lieve sottoconteggio sotto burst. Non sfruttabile in pratica;
eventualmente `f"{now}:{uuid4().hex[:8]}"` come member.

**Q6 — Warning pytest-asyncio.**
`asyncio_default_fixture_loop_scope` non impostato → deprecation warning a ogni run.
Aggiungere in `pyproject.toml`: `asyncio_default_fixture_loop_scope = "function"`.

---

## 4. Esiti verifiche

| Verifica | Esito |
|---|---|
| pytest (unit+integration+e2e, testcontainers) | **77/77 passed** |
| ruff (app + tests) | pulito |
| tsc --noEmit | pulito |
| eslint | 3 errori (Q3) |
| pip-audit | 1 advisory (fix disponibile) |
| npm audit | 2 moderate transitive (fix disponibile) |
| Sink XSS frontend | nessuno |
| Secret nel repo | nessuno (`.env` gitignored, Doppler in prod) |

## 5. Priorità suggerite

1. **Subito (5 min):** bump `pydantic-settings` → 2.14.2, `npm audit fix`, fix Q6.
2. **Prima del deploy staging:** M1 (admin dietro allowlist Caddy), M3 (compose prod separato), Q2 (boost refresh).
3. **Prima della release App Store:** L4 (URL restriction token Mapbox), L5 (privacy log IP), Q4 (niente `alert()`).
4. **Quando capita:** Q1 (dead code repository), Q3 (eslint), L2 (ETag), L1, L3, M2, Q5.

---
*Metodo: graphify (mappa architetturale, god nodes, dead-code detection), lettura mirata
di tutti i moduli backend e dei componenti frontend con superficie di rischio, esecuzione
test suite completa con testcontainers, ruff/tsc/eslint, pip-audit e npm audit.*
