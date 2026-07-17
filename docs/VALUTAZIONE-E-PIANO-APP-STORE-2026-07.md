# TorinoParking — Valutazione e piano per la pubblicazione su App Store

> 6 luglio 2026. Basato su: code review completa di oggi (`CODE-REVIEW-2026-07-06.md`),
> roadmap di marzo (`ANALISI-E-ROADMAP-iOS.md`), stato reale del repo su `main` e
> requisiti Apple verificati oggi dalle fonti ufficiali.

---

## 1. Valutazione sintetica

| Area | Voto | Commento |
|---|---|---|
| Backend | ★★★★☆ | Architettura pulita, security solida, 77/77 test. Manca solo hardening prod (compose, admin allowlist). |
| Frontend web | ★★★★☆ | React 19 + TS, mobile-first, a11y e haptics fatti. Zero test automatici, 1 bug reale (boost refresh). |
| iOS shell (Capacitor) | ★★★☆☆ | Piattaforma aggiunta, plugin giusti, permission string ok. Mancano privacy manifest, icona vera, build config release. |
| Infrastruttura | ★★☆☆☆ | Ottima per dev, **inesistente per produzione**: il backend non è deployato da nessuna parte. |
| Compliance App Store | ★★☆☆☆ | Toolchain già compatibile (Capacitor 8 + Xcode 26). Mancano gli artefatti di submission (manifest, assets, policy, account). |

**Giudizio complessivo: l'app è all'~80% del codice e al ~40% del percorso di
pubblicazione.** Il lavoro rimanente non è "scrivere l'app" — è deployment, compliance
e assets. Il rischio tecnico è basso; il grosso è operativo.

---

## 2. Cosa è già fatto (verificato oggi sul codice, non sulla memoria)

Della roadmap di marzo, le fasi 1–3 sono completate e merged:

- **Security fix**: Redis auth, Caddy TLS, HSTS+CSP, ProxyHeaders con trusted hosts, defusedxml, bind localhost per DB/Redis ✓
- **iOS native feel**: haptics su tutte le azioni, pull-to-refresh, splash screen config, status bar sync col tema, safe areas, OfflineBanner, portrait lock, ErrorBoundary ✓
- **Performance**: iconCache per i marker, `useMemo` sui filtri, AbortController sulla history, dedup repository nel route nearby, test middleware ✓
- **Stack moderno**: React 19.2, Vite 7.3, TS 5.9, Capacitor 8.3, FastAPI 0.133, Python 3.12, SQLAlchemy 2 async, PG16+PostGIS, Redis 7. Niente da "modernizzare" a livello di versioni major — lo stack è attuale a luglio 2026.

---

## 3. Requisiti Apple 2026 — stato di compliance

Verificati oggi (fonti in fondo):

| Requisito | Stato | Note |
|---|---|---|
| **Build con Xcode 26 / iOS 26 SDK** (obbligatorio dal 28 apr 2026 per ogni upload) | ✅ pronto | Capacitor 8 richiede Xcode 26.0+, quindi la toolchain è già allineata. Serve Xcode 26 installato sul Mac (macOS 15.6+ — ok). |
| Deployment target | ✅ | iOS 15.0 nel progetto — Apple richiede solo l'SDK di build, non il target. |
| `NSLocationWhenInUseUsageDescription` | ✅ | Presente in Info.plist con stringa italiana chiara, solo When-In-Use. |
| **PrivacyInfo.xcprivacy (privacy manifest app-level)** | ❌ mancante | Obbligatorio. Deve dichiarare: raccolta *Precise Location* (uso: App Functionality, non linked, no tracking) + eventuali required-reason API. I pod Capacitor portano i propri manifest; quello dell'app va creato. |
| **Account Apple Developer Program** ($99/anno) | ❌ | Prerequisito per tutto: signing, TestFlight, App Store Connect. |
| **Privacy Policy URL pubblica** | ❌ | Obbligatoria in App Store Connect e linkata in-app. `docs/GDPR.md` esiste già come base — va pubblicata come pagina web. |
| Privacy Nutrition Labels | ❌ | Da compilare in App Store Connect: Location (precisa) + Diagnostics se Sentry attivo. Niente tracking → niente ATT. |
| App Icon 1024×1024 | ❌ | C'è ancora il placeholder Capacitor (`AppIcon-512@2x.png`). Con Xcode 26 basta la singola 1024×1024. |
| Screenshot (6.9"/6.7" + 6.1") | ❌ | Da produrre dal simulatore dopo il freeze UI. |
| Metadata (descrizione IT/EN, keywords, categoria Navigation, support URL) | ❌ | Mezza giornata di lavoro. |
| ATS (App Transport Security) | ⚠️ dipende dal deploy | L'app in produzione chiamerà il backend via HTTPS: serve un dominio con certificato valido (Caddy/Let's Encrypt lo fa da solo, ma serve un server). |

---

## 4. Il blocco #1: il backend non è in produzione

È il gap più grande e l'unico davvero strutturale. Oggi l'app funziona solo con
backend locale + ngrok per il beta tester. **Un'app pubblicata deve puntare a un
backend pubblico, stabile, HTTPS.** Inoltre `frontend/src/services/api.ts` usa
`VITE_API_URL || ""`: nel build iOS (dist bundlata, origin `capacitor://localhost`)
l'URL relativa non funziona — **la build release deve avere `VITE_API_URL`
impostata all'URL di produzione.**

Opzioni sul tavolo (decisione tua, non mia):

1. **FastAPI Cloud** (hai già l'accesso beta, era il piano come staging) — attrito minimo per FastAPI, ma servono anche Postgres+PostGIS e Redis gestiti.
2. **Render** (MCP già configurato in questa sessione) — web service + Postgres gestito + Key-Value store, tutto in un posto; PostGIS supportato.
3. **VPS con il tuo docker-compose** (Hetzner/DO ~5-10€/mese) — riusa Caddy e il compose quasi as-is (serve la variante prod: no `--reload`, no mount, no Dockhand), massimo controllo, più manutenzione.

Requisiti indipendenti dalla scelta: dominio (~10€/anno), variante prod del compose o
config equivalente, migrazioni Alembic al deploy (entrypoint già pronto), Doppler per i
secret (già integrato), Sentry attivo in prod.

---

## 5. Piano di lavoro ordinato

### Fase A — Igiene (½ giornata)
1. Fix dal report di oggi, gruppo "subito": bump `pydantic-settings`, `npm audit fix`, config pytest-asyncio.
2. Bug boost refresh (`useParkings.ts`) — impatta batteria iOS, va fatto prima della release.
3. Fix 3 errori ESLint + rimozione `alert()` a favore di banner in-app.

### Fase B — Backend in produzione (1-2 giornate + decisione hosting)
1. Scegliere hosting (§4) e registrare dominio.
2. `docker-compose.prod.yml` (o config Render/FastAPI Cloud): no reload, no source mount, no Dockhand, admin routes dietro allowlist (M1 del report).
3. Deploy + smoke test: `/health`, fetch 5T schedulato, HTTPS valido.
4. Beta tester passa da ngrok all'URL di produzione (test reale da Torino).

### Fase C — Compliance Apple (1 giornata)
1. Iscrizione Apple Developer Program ($99/anno) — tempi di verifica: 1-2 giorni.
2. Creare `PrivacyInfo.xcprivacy` app-level (Location precisa, App Functionality, no tracking).
3. Pubblicare la Privacy Policy come pagina web (base: `docs/GDPR.md`) — può stare sullo stesso dominio del backend.
4. Icona definitiva 1024×1024 + splash coerente.
5. Restringere il token Mapbox per URL/bundle (L4 del report); decidere se troncare gli IP nei log (L5).

### Fase D — Build & TestFlight (1 giornata)
1. `VITE_API_URL=https://<dominio>` → `npm run build` → `npx cap sync ios`.
2. Xcode 26: signing con il team, archive, upload a App Store Connect.
3. TestFlight interno → beta tester Torino. Un ciclo di feedback reale.

### Fase E — Submission (½ giornata + attesa review)
1. Screenshot (6.9" e 6.1" dal simulatore), descrizione IT/EN, keywords, categoria Navigation, support URL, nutrition labels.
2. Note per il reviewer: l'app usa dati open 5T, nessun login richiesto — riduce i rischi di Guideline 4.2.
3. Submit. Review tipica: 1-3 giorni. Prevedere un giro di rejection fisiologico.

### Post-launch (differenziazione, dalla roadmap di marzo — invariata)
Push notification ("si è liberato un posto"), widget iOS, Siri Shortcuts, CarPlay stretch.

**Totale stimato: ~4-5 giornate effettive di lavoro + attese (verifica account, review).**

### Facoltativo "100% moderno" (non blocca nulla)
- Test frontend con Vitest (almeno smoke sui filtri e su `useParkings`) — unico vero gap di qualità rimasto.
- Split di `Sidebar.tsx` (405 righe/19 props) e del CSS monolitico — refactor cosmetico.
- APScheduler 3.x → 4.x solo quando stabile; oggi funziona e non è un rischio.
- Dead code `db_repository` (Q1 del report).

---

## Fonti

- [Apple — Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Apple — SDK minimum requirements (02/2026)](https://developer.apple.com/news/upcoming-requirements/?id=02032026a)
- [Apple — App Store submissions open for latest OS](https://developer.apple.com/news/?id=6lxhtioi)
- [Expo — App Store Connect minimum SDK 26](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
- [Capacitor iOS docs — requisiti ambiente](https://capacitorjs.com/docs/ios)
