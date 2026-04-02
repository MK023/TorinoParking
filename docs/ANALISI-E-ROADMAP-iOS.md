# TorinoParking — Analisi Completa e Roadmap iOS App Store

> Analisi eseguita il 28 marzo 2026. Copre backend, frontend, infrastruttura, sicurezza OWASP e requisiti Apple App Store.

---

## Indice

1. [Architettura Attuale](#1-architettura-attuale)
2. [Punti di Forza](#2-punti-di-forza)
3. [OWASP Top 10 — Assessment](#3-owasp-top-10--assessment)
4. [Problemi Critici — Sicurezza](#4-problemi-critici--sicurezza)
5. [Problemi Backend](#5-problemi-backend)
6. [Problemi Frontend](#6-problemi-frontend)
7. [Problemi Infrastruttura](#7-problemi-infrastruttura)
8. [Requisiti iOS App Store](#8-requisiti-ios-app-store)
9. [Piano di Lavoro](#9-piano-di-lavoro)

---

## 1. Architettura Attuale

```
Client (Browser/Mobile)
    │
    ├── Frontend: React 19 + Vite 7 + TypeScript 5.9 + Leaflet/Mapbox
    │
    ├── Backend: FastAPI + Uvicorn (Python 3.12)
    │   ├── Redis 7 (cache + rate limiting)
    │   ├── PostgreSQL 16 + PostGIS (dati + spatial queries)
    │   └── APScheduler (fetch 5T ogni 2 min)
    │
    └── Dati: 5T Torino Open Data (XML) + GTT (dettagli statici)
```

| Componente | Tecnologia | Versione |
|------------|-----------|----------|
| Backend | FastAPI | 0.133.0 |
| ORM | SQLAlchemy (async) | 2.0.47 |
| Cache | Redis + hiredis | 7.2.0 |
| Serializzazione | orjson + zlib | 3.11.7 |
| Scheduler | APScheduler | 3.11.2 (legacy) |
| HTTP Client | httpx | 0.28.1 |
| XML Parser | xmltodict | 1.0.4 |
| Logging | structlog | 25.5.0 |
| Frontend | React | 19.2 |
| Bundler | Vite | 7.3 |
| Mappa | Leaflet + react-leaflet + Mapbox | — |
| Container | Docker Compose | 4 servizi |

---

## 2. Punti di Forza

- **Clean Architecture** con separazione domain/infrastructure/API e Protocol-based interfaces
- **Domain entities immutabili** (frozen dataclass) con computed properties ben testate
- **Redis cache robusto** con compressione trasparente, ETag, graceful degradation
- **API key management** con HMAC-SHA256, entropia 256-bit, hash-only storage
- **Rate limiting multi-tier** (anonymous/authenticated/premium) con sliding window
- **Logging strutturato** con request ID correlation e Sentry integration
- **Validazione secrets in produzione** (minimo 32 char admin key, 16 char salt)
- **CI pipeline completa** con lint, test, security scan (bandit, pip-audit, gitleaks)
- **Dependabot** su 4 ecosistemi (pip, npm, docker, GitHub Actions)
- **Frontend mobile-first** con bottom sheet, swipe gestures, safe area insets
- **Dark mode** con OS preference tracking

---

## 3. OWASP Top 10 — Assessment

| # | Categoria | Stato | Note |
|---|-----------|-------|------|
| A01 | Broken Access Control | PARZIALE | Admin protetto con HMAC. Nessuna auth JWT/session per utenti. |
| A02 | Cryptographic Failures | CRITICO | DB senza TLS. Redis senza auth. HMAC salt statico debole. |
| A03 | Injection | OK | SQLAlchemy parametrizzato ovunque. Nessun SQL raw. |
| A04 | Insecure Design | OK | Architettura pulita, Pydantic validation, rate limiting. |
| A05 | Security Misconfiguration | CRITICO | Debug default, credenziali default in .env, --reload in compose. |
| A06 | Vulnerable Components | OK | Dependabot + pip-audit + npm audit in CI. |
| A07 | Auth Failures | PARZIALE | Nessuna rotazione API key. Chiavi revocate valide 60s. Admin 422 vs 401. |
| A08 | Data Integrity | PARZIALE | Nessun hash pinning pip. GitHub Actions non SHA-pinned. |
| A09 | Logging & Monitoring | OK | structlog, access log, Sentry, request ID. |
| A10 | SSRF | OK | URL 5T hardcoded, non controllabile dall'utente. |

---

## 4. Problemi Critici — Sicurezza

### 4.1 Redis senza autenticazione
- Chiunque sulla rete Docker puo' connettersi
- **Fix:** aggiungere `--requirepass` in docker-compose e aggiornare `REDIS_URL`

### 4.2 Nessun TLS
- Nessun reverse proxy. Tutto HTTP in chiaro.
- **Fix:** aggiungere Caddy o Traefik con auto-TLS (Let's Encrypt)

### 4.3 Backend/Frontend esposti su 0.0.0.0
- Postgres e Redis sono bindati a `127.0.0.1`, ma backend (8000) e frontend (3000) no
- **Fix:** bindare a `127.0.0.1` e servire tramite reverse proxy

### 4.4 Rate Limiting rotto dietro proxy
- Usa `request.client.host` che dietro reverse proxy e' sempre l'IP del proxy
- Tutti i client condividono lo stesso bucket
- **Fix:** leggere `X-Forwarded-For` con `ProxyHeadersMiddleware`

### 4.5 XML parsing senza protezione XXE
- `xmltodict` non protegge da XML bomb o XXE
- Rischio basso (fonte 5T trusted) ma va hardened
- **Fix:** usare `defusedxml` o passare `forbid_dtd=True, forbid_entities=True`

### 4.6 Header di sicurezza mancanti
- Manca `Strict-Transport-Security` (HSTS)
- Manca `Content-Security-Policy` (CSP)
- **Fix:** aggiungere in `SecurityHeadersMiddleware`

### 4.7 Segreti nel .env
- `ADMIN_API_KEY`, `POSTGRES_PASSWORD`, `HMAC_SALT`, `MAPBOX_TOKEN` in chiaro
- **Verificare:** se mai committato nella git history, ruotare TUTTI i segreti
- **Fix:** verificare con `git log --all -- .env`

---

## 5. Problemi Backend

### Priorita' ALTA
| Problema | File | Dettaglio |
|----------|------|-----------|
| Upsert N+1 nello scheduler | `scheduler.py:84-107` | Query singola per ogni parcheggio. Usare batch upsert. |
| Duplicazione logica upsert/snapshot | `scheduler.py` vs `db_repository.py` | Lo scheduler reimplementa la stessa logica del repository. |
| BaseHTTPMiddleware | `middleware.py` | Wrappa response in memoria, puo' rompere streaming. Starlette sconsiglia. |

### Priorita' MEDIA
| Problema | File | Dettaglio |
|----------|------|-----------|
| API key cache senza locking | `api_key_cache.py` | Stato globale mutabile, thundering herd su expiry. |
| Admin 422 vs 401 | `routes/admin.py` | `Header(...)` required ritorna 422 senza header. Dovrebbe essere 401. |
| APScheduler 3.x legacy | `scheduler.py` | La 4.x ha async nativo. La 3.x non e' piu' il focus dello sviluppo. |
| Nessun circuit breaker per 5T | `scheduler.py` | Fallimento upstream silenzioso ogni 2 min, solo log. |
| Health non verifica 5T | `routes/health.py` | `five_t_api` sempre "configured", mai verificato realmente. |

### Priorita' BASSA
| Problema | File | Dettaglio |
|----------|------|-----------|
| Pool size DB hardcoded | `database.py` | `pool_size=10, max_overflow=5` non configurabili via settings. |
| `verify_key()` dead code | `api_key_service.py` | Mai chiamato. La verifica passa da `api_key_cache.py`. |
| Float per valori monetari | `db_models.py` | `Numeric(5,2)` mappato a `float`. Dovrebbe essere `Decimal`. |
| Test time-dependent fragile | `test_history.py:36` | `now.replace(hour=max(0, now.hour - i))` crea duplicati tra mezzanotte e le 4. |
| Nessun test per middleware | `tests/` | RateLimitMiddleware, SecurityHeaders, RequestID non testati a livello HTTP. |

---

## 6. Problemi Frontend

### Priorita' ALTA
| Problema | File | Dettaglio |
|----------|------|-----------|
| Zero test | — | Nessun Vitest, nessun test file. Zero coverage. |
| Nessun Error Boundary | `App.tsx` | Crash = schermo bianco. Obbligatorio per App Store. |
| `createIcon()` per ogni render | `ParkingMap.tsx:31-93` | ~50 `L.DivIcon` ricreati ad ogni render. Cache per chiave. |
| Accessibilita' rotta | Multipli | `<div onClick>` senza keyboard, nessun focus trap, nessun `aria-label`. |

### Priorita' MEDIA
| Problema | File | Dettaglio |
|----------|------|-----------|
| Nessun AbortController | `api.ts`, `ParkingDetail.tsx` | Race condition su selezione rapida parcheggi. |
| Filtri non memoizzati | `useParkings.ts:160` | `parkings.filter()` su ogni render. Usare `useMemo`. |
| `aggregateByHour` non memoizzato | `ParkingDetail.tsx:86` | Ricalcolato ad ogni render. |
| `100vh` su iOS Safari | `app.css` | Contenuto nascosto dalla toolbar. Servono `100dvh` con fallback. |
| Service Worker morto | `public/sw.js` | Catcha tiles `cartocdn.com` ma l'app usa `mapbox.com`. |
| Sidebar troppo grande | `Sidebar.tsx` | 405 righe, 19 props. Va splittato. |
| CSS monolitico | `app.css` | 1800 righe. Servono CSS modules o scoped styles. |
| MarkerClusterGroup key change | `ParkingMap.tsx:209` | Unmount/remount di tutti i marker su cambio POI. Flash visibile. |

### Priorita' BASSA
| Problema | File | Dettaglio |
|----------|------|-----------|
| `navigator.platform` deprecated | `utils/parking.ts:51` | iOS detection fragile. Usare `navigator.userAgentData`. |
| `alert()` per errori | `App.tsx:61,77` | Blocca main thread. Usare toast/inline. |
| Nessun code splitting | — | App caricata tutta upfront. |
| Icone SVG senza `aria-hidden` | `Icons.tsx` | Screen reader tenta di parsare le SVG decorative. |
| Prop drilling estremo | `App.tsx` → `Sidebar` | 19 props. Considerare Context o state manager. |
| `-webkit-overflow-scrolling: touch` | `app.css` | Deprecated, ora default in iOS Safari. |

---

## 7. Problemi Infrastruttura

| Priorita' | Problema | Dettaglio |
|-----------|----------|-----------|
| ALTA | Docker socket montato in Dockhand | Root-equivalent access all'host. Gated da profile `tools` ma pericoloso. |
| ALTA | Nessun docker-compose di produzione | `--reload`, volume mount sorgenti, debug attivo nel compose unico. |
| MEDIA | Image pinning parziale | Tag minor ma nessun SHA digest. `dockhand:latest` imprevedibile. |
| MEDIA | Nessun resource limit | Container senza limiti CPU/RAM. |
| MEDIA | Nessun lock file Python | `requirements.txt` senza `--require-hashes`. Dipendenze transitive non pinnate. |
| MEDIA | GitHub Actions non SHA-pinned | `@v6`, `@v3`, `@v2` — tag mutabili. |
| MEDIA | Ruff version mismatch | CI usa `0.8.0`, requirements-dev `0.15.2`. |
| BASSA | Nessun container image scanning | Manca Trivy/Grype in CI. |
| BASSA | Nessuna segmentazione rete | Tutti i servizi su una singola bridge network. |
| BASSA | `parking_snapshots` crescita illimitata | Nessun partitioning. Considerare TimescaleDB. |

---

## 8. Requisiti iOS App Store

### 8.1 Approccio Consigliato: Capacitor

| Approccio | Pro | Contro | Rischio Rifiuto |
|-----------|-----|--------|-----------------|
| **Capacitor** | Riusa 90% codice React, plugin nativi | Performance mappa < native | Basso se UX curata |
| React Native | Performance nativa | Riscrittura quasi totale | Molto basso |
| PWA | Zero riscrittura | Apple limita PWA (no push, no background, 50MB limit) | Quasi certo rifiuto |

**Raccomandazione: Capacitor.** Massimo riuso, minimo effort, rischio gestibile.

### 8.2 App Store Review Guidelines — Requisiti

#### Design (Guideline 4.0)
- Native navigation patterns (no browser UI)
- Haptic feedback su azioni
- iOS-native gestures (swipe back, pull-to-refresh)
- Status bar integration
- Dynamic Type support (font scala con preferenze utente)

#### Minimum Functionality (Guideline 4.2)
- L'app deve offrire valore oltre un sito web
- Suggerimento: push notifications, widget iOS, navigazione con Mappe Apple

#### Privacy (Guideline 5.1) — CRITICO
- **Privacy Policy obbligatoria** — URL pubblico, linkata in-app e in App Store Connect
- **App Tracking Transparency (ATT)** — se usi analytics/tracking serve popup nativo
- **Location permission** — stringa chiara: "Per mostrarti i parcheggi piu' vicini"
- Solo "When In Use", mai "Always"

#### Privacy Nutrition Labels
| Dato | Lo raccogli? | Dichiarazione |
|------|-------------|---------------|
| Location (precisa) | SI — geolocation | Obbligatorio |
| Usage Data | Dipende — Sentry? | Se attivo, SI |
| Diagnostics | SI — crash Sentry | SI |
| Identifiers | NO | OK |
| Contact Info | NO | OK |
| Purchases | NO | OK |

### 8.3 Human Interface Guidelines — Cosa Manca

| Requisito HIG | Stato | Da Fare |
|---------------|-------|---------|
| Safe Areas (top + bottom) | Parziale | Aggiungere top per Dynamic Island/notch |
| Dynamic Type | Assente | Font deve scalare con preferenze iOS |
| Haptic Feedback | Assente | Tap marker, pull-to-refresh, toggle filtri |
| Pull-to-Refresh | Assente | Obbligatorio per app dati real-time |
| Native Splash Screen | Assente | SplashScreen Capacitor |
| App Icon | Assente | 1024x1024 + tutti i formati |
| VoiceOver | Rotto | `<div onClick>` invisibili, no aria-label |
| Reduce Motion | Assente | `prefers-reduced-motion` per animazioni |
| Color contrast daltonici | Parziale | Marker solo colore, aggiungere forme/pattern |
| Landscape | Non gestito | Lock portrait o supporto base |

### 8.4 Capacitor — Plugin Necessari

```
@capacitor/geolocation        GPS nativo
@capacitor/haptics             Feedback tattile
@capacitor/status-bar          Integrazione status bar
@capacitor/splash-screen       Splash nativo
@capacitor/keyboard            Gestione tastiera
@capacitor/push-notifications  Notifiche (post-launch)
@capacitor/app                 Lifecycle, deep links
@capacitor/network             Detect offline
```

### 8.5 Asset Obbligatori per App Store Connect

- Icona 1024x1024 (no trasparenza, no angoli arrotondati)
- Screenshot per: iPhone 6.7" (15 Pro Max), 6.1" (15 Pro), 5.5" (8 Plus)
- Descrizione IT + EN
- Keywords (max 100 caratteri)
- Privacy Policy URL
- Support URL (email o pagina web)
- Categoria: Navigation
- Age Rating: 4+
- Account Apple Developer ($99/anno)

---

## 9. Piano di Lavoro

### Fase 0 — Pre-requisiti
- [ ] Account Apple Developer ($99/anno)
- [ ] Scrivere Privacy Policy (pagina web pubblica)
- [ ] Verificare git history per segreti esposti: `git log --all -- .env`
- [ ] Decidere conferma approccio Capacitor

### Fase 1 — Security Fix + Fondamenta iOS
- [ ] Redis auth (`--requirepass`)
- [ ] Bind backend/frontend a `127.0.0.1`
- [ ] Reverse proxy con TLS (Caddy)
- [ ] Header HSTS + CSP
- [ ] Fix rate limiter con `X-Forwarded-For`
- [ ] `defusedxml` per XML parsing
- [ ] Setup Capacitor nel progetto frontend
- [ ] Error Boundary React
- [ ] `100vh` → `100dvh`

### Fase 2 — iOS Native Feel
- [ ] Haptic feedback (selezione parcheggio, pull-to-refresh, filtri)
- [ ] Pull-to-refresh nativo
- [ ] Native splash screen + app icon design
- [ ] Status bar integration (colore adattivo)
- [ ] Dynamic Type support
- [ ] Safe areas complete (top + bottom)
- [ ] Offline detection con messaggio utente
- [ ] Lock portrait o supporto landscape
- [ ] VoiceOver: keyboard nav, ARIA labels, focus trap

### Fase 3 — Performance & Qualita'
- [ ] Memoizzare `createIcon`, filtri, `aggregateByHour`
- [ ] `AbortController` su API call
- [ ] Batch upsert nello scheduler
- [ ] Eliminare duplicazione scheduler/repository
- [ ] Splittare Sidebar.tsx e CSS
- [ ] Fix/rimuovere Service Worker
- [ ] Test frontend con Vitest (almeno smoke test)
- [ ] Test middleware backend

### Fase 4 — App Store Submission
- [ ] Privacy Nutrition Labels in App Store Connect
- [ ] Location permission strings (`NSLocationWhenInUseUsageDescription`)
- [ ] ATT se necessario
- [ ] TestFlight beta con tester reali
- [ ] Screenshot per tutti i device richiesti
- [ ] Metadata App Store Connect (descrizione IT/EN, keywords, categoria)
- [ ] Review submission

### Fase 5 — Post-Launch (differenziazione)
- [ ] Push notifications (parcheggio si libera)
- [ ] Widget iOS (parcheggi preferiti)
- [ ] Apple Maps integration nativa
- [ ] Siri Shortcuts ("trova parcheggio vicino a me")
- [ ] CarPlay (stretch goal)

---

> Documento generato da analisi automatica. Ogni file del progetto e' stato letto e analizzato.
