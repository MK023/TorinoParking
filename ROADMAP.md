# Roadmap

Stato attuale e miglioramenti futuri per portare il backend a livello enterprise e pubblicare su App Store.

**Legenda**: [x] fatto | [ ] da fare | [$] richiede budget

---

## Stato attuale (completato)

### Backend
- [x] API REST FastAPI async con Redis cache e PostgreSQL/PostGIS
- [x] Scheduler in-process APScheduler (3 job: fetch 5T, cleanup cache, purge snapshots)
- [x] Gestione API key con hash SHA-256 HMAC in PostgreSQL
- [x] Admin CRUD key via `X-Admin-Key` (POST/GET/DELETE)
- [x] Rate limiting sliding window multi-tier (anonymous/auth/premium)
- [x] Cache in-memory API key con TTL 60s (zero DB hit nel hot path)
- [x] Dati arricchiti GTT: 22 parcheggi con indirizzo, tariffe, pagamenti, bus, metro
- [x] Merge automatico dati real-time 5T + dettagli statici GTT nella cache
- [x] Status label calcolato: aperto / pieno / fuori servizio / nessun dato
- [x] Compressione trasparente orjson + zlib con ETag
- [x] Test suite: unit + integration (testcontainers) + e2e (respx)
- [x] CI/CD GitHub Actions: lint → test → Docker build
- [x] Migration Alembic: 001 schema iniziale, 002 api_keys, 003 parking_details + seed
- [x] HMAC salt configurabile via env var (non piu' hardcoded)
- [x] Endpoint `/api/v1/parkings/nearby` - ricerca geo-spaziale PostGIS
- [x] Endpoint `/api/v1/parkings/{id}/history` - storico disponibilita'
- [x] Filtri su `/api/v1/parkings`: `?available=true`, `?min_spots=N`

### Frontend
- [x] React 19 + TypeScript SPA con Vite
- [x] Mappa interattiva Leaflet dark-themed centrata su Torino
- [x] Marker colorati per occupazione (verde/ambra/rosso/grigio)
- [x] Geolocalizzazione "Vicino a me" con endpoint nearby
- [x] Pannello dettaglio con info GTT (tariffe, pagamenti, bus, metro)
- [x] Grafico storico disponibilita' (ultime 6 ore)
- [x] Auto-refresh ogni 2 minuti
- [x] Filtri: solo disponibili, posti minimi, raggio ricerca
- [x] Ricerca parcheggi per nome
- [x] Design responsive (mobile + desktop)
- [x] Docker container con hot reload

---

## Enterprise Ready — Sicurezza

- [ ] HTTPS/TLS obbligatorio — reverse proxy con certificato SSL
  - Opzione gratuita: Caddy (auto-HTTPS con Let's Encrypt)
  - [$] Opzione managed: AWS ALB / Cloudflare
- [ ] Rotazione automatica API key con grace period (vecchia key valida 24h dopo rotazione)
- [ ] Audit log: tabella `audit_events` con ogni operazione admin (chi, cosa, quando, IP)
- [ ] HMAC salt rotabile via env var con supporto multi-salt in fase di migrazione (salt singolo gia' configurabile via env)
- [ ] CORS lockdown: origini specifiche per produzione (no wildcard)
- [ ] Helmet-style headers completi: CSP, HSTS, Referrer-Policy, Permissions-Policy
- [ ] Secrets management: Doppler o AWS Secrets Manager (no .env in produzione)
- [ ] Dependency scanning automatico: Dependabot o Snyk nella CI
- [ ] Rate limiting per-endpoint configurabile (non solo globale)
- [ ] IP allowlist per admin routes in produzione
- [ ] Request body size limit e timeout aggressivi su endpoint pubblici

## Enterprise Ready — Affidabilita e Resilienza

- [ ] Health check approfondito: verificare anche scheduler running e ultima fetch riuscita
- [ ] Circuit breaker su chiamate 5T (evitare cascading failure se 5T e' giu')
- [ ] Retry con exponential backoff su fetch 5T fallite
- [ ] Graceful degradation: servire dati dalla cache anche se scaduti quando 5T non risponde
- [ ] Dead letter queue: loggare e tracciare ogni fetch fallita per analisi
- [ ] Connection pool monitoring: alert se pool PostgreSQL o Redis vicino al limite
- [ ] Liveness e readiness probe separate per orchestratori (Kubernetes)
- [ ] Database connection retry on startup con backoff (gia' parzialmente presente)

## Enterprise Ready — Osservabilita

- [ ] Prometheus metrics endpoint (`/metrics`) con metriche custom:
  - `parking_fetch_duration_seconds` (histogram)
  - `parking_fetch_errors_total` (counter)
  - `parking_cache_hit_ratio` (gauge)
  - `parking_api_requests_total` per tier (counter)
- [ ] Grafana dashboard preconfigurata (JSON provisioning)
- [ ] Alerting: notifiche Slack/email su errori scheduler, degraded health, alta latenza
- [ ] Structured logging JSON in produzione con correlation ID end-to-end
- [ ] Sentry: breadcrumbs su ogni fetch cycle, performance tracing su endpoint
- [ ] Access log analytics: top endpoint, latenza p50/p95/p99, errori per minuto
- [ ] Uptime monitoring esterno (es. UptimeRobot gratuito, o Pingdom [$])

## Enterprise Ready — Infrastruttura e Deploy

### Opzioni gratuite / low-cost
- [ ] Deploy su Fly.io (free tier: 3 VM shared, 256MB RAM) o Railway (trial $5/mese)
- [ ] Caddy come reverse proxy con auto-HTTPS (Let's Encrypt gratuito)
- [ ] PostgreSQL managed: Neon (free tier 0.5GB) o Supabase (free tier 500MB)
- [ ] Redis managed: Upstash (free tier 10k comandi/giorno) o Redis Cloud (30MB free)
- [ ] CI/CD: GitHub Actions gia' configurato (2000 min/mese gratis)
- [ ] DNS: Cloudflare free tier (DNS + proxy + SSL)
- [ ] Monitoring: UptimeRobot free (50 monitor, check ogni 5 min)

### Opzioni a pagamento (quando serve scalare) [$]
- [$] Load balancer managed (AWS ALB ~$16/mese, o Cloudflare LB ~$5/mese)
- [$] PostgreSQL managed con backup automatico (AWS RDS, ~$15/mese per db.t3.micro)
- [$] Redis managed con persistence (AWS ElastiCache, ~$12/mese per cache.t3.micro)
- [$] Container hosting: AWS ECS Fargate (~$10/mese per 0.25 vCPU), GCP Cloud Run (pay-per-request)
- [$] CDN: Cloudflare Pro ($20/mese) o AWS CloudFront (pay-per-request)
- [$] Log aggregation: Datadog (~$15/host/mese) o Grafana Cloud (free fino a 50GB/mese)

### Deploy pipeline
- [ ] CD automatico su push a `main` (deploy su staging, poi promozione manuale a prod)
- [ ] Multi-environment: staging + production con env var separate
- [ ] Database migration automatica nel deploy (gia' presente in entrypoint.sh)
- [ ] Rollback automatico se health check fallisce dopo deploy
- [ ] Blue-green o canary deployment per zero-downtime
- [ ] Backup automatico PostgreSQL con retention 30 giorni
- [ ] Disaster recovery: restore testato periodicamente

---

## Dati & Accuratezza

### Fonti dati gia' integrate
- [x] 5T Open Data real-time: 40 parcheggi, aggiornamento ogni 120s
- [x] GTT scraping statico: 22 parcheggi con dettagli completi (tariffe, pagamenti, bus)

### Miglioramenti dati
- [ ] Scraping periodico GTT (mensile) per aggiornare tariffe e orari
- [ ] Integrazione dati Comune di Torino (aperTO) per parcheggi non GTT
- [ ] Validazione incrociata: confronto `total_spots` 5T vs GTT, alert su discrepanze
- [ ] Storico tariffe: tracciare variazioni di prezzo nel tempo
- [ ] Geocoding inverso: da coordinate a indirizzo leggibile per parcheggi senza dettaglio GTT
- [ ] Orari di apertura effettivi: distinguere "chiuso per orario" da "fuori servizio"
- [ ] Dati di affluenza storici per previsioni (vedi ML sotto)

### Endpoint dati avanzati
- [x] `GET /api/v1/parkings/{id}/history?from=&to=` — storico disponibilita'
- [x] `GET /api/v1/parkings/nearby?lat=&lng=&radius=` — ricerca geospaziale PostGIS
- [ ] `GET /api/v1/parkings?payment=telepass` — filtro per metodo pagamento
- [x] `GET /api/v1/parkings?available=true&min_spots=5` — filtri disponibilita'
- [ ] `GET /api/v1/parkings?sort=distance&lat=&lng=` — ordinamento per distanza
- [ ] Aggregazioni: occupazione media per fascia oraria/giorno della settimana
- [ ] Export CSV/JSON per analisi offline

### ML e Predizioni (futuro)
- [ ] Dataset training: almeno 3 mesi di snapshot storici
- [ ] Modello previsione disponibilita' a 30/60 minuti (time series forecasting)
- [ ] Endpoint `GET /api/v1/parkings/{id}/prediction?minutes=30`
- [ ] Feature engineering: giorno settimana, ora, meteo, eventi in citta'

---

## Metodi di Pagamento & Servizi

- [x] Modello dati `payment_methods` (array PostgreSQL) associato a ogni parcheggio
- [x] Dati reali scrappati da GTT: Telepass, carte, bancomat, cassa automatica, parcometro
- [x] Campo `payment_methods` nell'API response (dentro `detail`)
- [ ] Filtro per metodo di pagamento: `GET /api/v1/parkings?payment=telepass`
- [ ] Normalizzazione metodi pagamento (enum: `cash`, `card`, `telepass`, `app`, `parcometer`)
- [ ] Abbonamenti: dettaglio completo (mensile/trimestrale/annuale, diurno/24h, residenti)
- [ ] Integrazione diretta Telepass per verifica copertura in tempo reale [$]
- [ ] Confronto tariffe: endpoint che ordina parcheggi per prezzo nella zona

---

## Mobile / App Store (iOS)

### Obbligatorio per pubblicazione
- [ ] Deploy cloud produzione con HTTPS/TLS
- [ ] Sign in with Apple: flusso OAuth + JWT per autenticazione utente
- [ ] Privacy Policy pubblicata su URL pubblica (richiesta da App Store Connect)
- [ ] App Store privacy nutrition labels: dichiarazione dati raccolti/utilizzati
- [ ] Tabella `users` con profilo utente, preferiti, impostazioni notifiche
- [ ] Endpoint `DELETE /api/v1/auth/account` — cancellazione account (obbligatorio)

### Autenticazione utente
- [ ] Endpoint `POST /api/v1/auth/apple` — verifica identity token Apple e crea sessione
- [ ] JWT access token (15 min) + refresh token (30 giorni)
- [ ] Middleware autenticazione utente separato da API key (coesistenza)
- [ ] Token blacklist su logout/revoca

### Push Notifications
- [ ] Integrazione APNs (Apple Push Notification service) lato backend
- [ ] Tabella `device_tokens` per registrazione dispositivi
- [ ] Endpoint `POST /api/v1/notifications/register`
- [ ] Trigger: notifica quando parcheggio preferito torna disponibile
- [ ] Gestione silenziosa token scaduti/invalidi (feedback APNs)

### Esperienza mobile
- [ ] API versioning header-based (`Accept-Version`) per backward compatibility
- [ ] Risposte leggere: `?fields=id,name,free_spots,detail.payment_methods`
- [ ] Endpoint preferiti: `GET/POST/DELETE /api/v1/users/me/favorites`
- [ ] Cache headers per NSURLCache iOS (`Cache-Control: max-age`, `Last-Modified`)
- [ ] Feature flags remoti per abilitare/disabilitare funzionalita' dall'app

### Conformita e Review
- [ ] Rate limiting per-utente (non solo per IP/API key)
- [ ] Logging conforme GDPR: nessun dato personale nei log di produzione
- [ ] Endpoint `/api/v1/users/me/data` — export dati utente (diritto di accesso GDPR)
- [ ] Rispetto linee guida App Store Review sezione 4.2 (minima funzionalita')

---

## Qualita del Codice

- [ ] mypy strict mode su tutto il codebase
- [ ] Mutation testing (mutmut) per validare efficacia dei test
- [ ] Load testing con Locust: profilo di carico realistico
- [ ] Pre-commit hooks: ruff + mypy + test unitari
- [ ] API contract testing con Schemathesis
- [ ] Coverage target: 90%+ (attualmente 80%)
- [ ] Documentazione API OpenAPI completa con esempi per ogni endpoint

---

## Note su costi

Il backend puo' partire **interamente gratis** con:
- **Fly.io** free tier (o Railway trial) per il container
- **Neon** o **Supabase** free tier per PostgreSQL
- **Upstash** free tier per Redis
- **Caddy** auto-HTTPS con Let's Encrypt
- **Cloudflare** free tier per DNS e proxy
- **GitHub Actions** per CI/CD (2000 min/mese gratis)

Il load balancer serio (AWS ALB, Cloudflare LB) servira' solo quando il traffico giustifica piu' istanze. Per un'app nuova su App Store, una singola istanza con Caddy davanti regge tranquillamente migliaia di utenti.

Quando servira' scalare, i costi stimati sono ~$50-80/mese per un setup produzione base (LB + DB managed + Redis managed + container hosting).
