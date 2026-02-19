# Torino Parking

> Disponibilita parcheggi in tempo reale a Torino. Dati open data 5T aggiornati ogni 2 minuti.

## Stack

**Backend:** Python 3.12, FastAPI, PostgreSQL + PostGIS, Redis, APScheduler
**Frontend:** React 19, TypeScript, Vite 7, Leaflet, Mapbox
**Infra:** Docker Compose, GitHub Actions CI

## Funzionalita

- Mappa interattiva con 40 parcheggi e marker colorati per stato (libero/pieno/fuori servizio/chiuso)
- Clustering marker, triangoli per parcheggi quasi pieni
- Dettaglio parcheggio: tariffe, pagamenti, trasporti, posti disabili (dati GTT)
- Grafico storico disponibilita (ultime 6 ore)
- Geolocalizzazione "Vicino a me" con ricerca PostGIS
- Filtri: stato, servizi (disabili, POS, coperto, metro), punti di interesse (ospedali, universita)
- Tema chiaro/scuro con tile Mapbox dinamiche
- Meteo in tempo reale (OpenMeteo)
- Mobile: bottom sheet iOS-style con swipe-down, frosted glass, touch target 44px
- Desktop: sidebar collassabile con statistiche
- Auto-refresh smart (2 min consultazione, 30s dopo geolocalizzazione)
- API REST con rate limiting, API key HMAC-SHA256, cache Redis compressa

## Quick Start

```bash
git clone https://github.com/MK023/TorinoParking.git
cd TorinoParking
cp .env.example .env
# Edit .env with your credentials and VITE_MAPBOX_TOKEN
docker compose up -d
# Backend: http://localhost:8000/docs
# Frontend: http://localhost:3000
```

## Documentazione

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architettura del sistema
- [SETUP.md](docs/SETUP.md) - Guida setup completa
- [SECURITY.md](docs/SECURITY.md) - Sicurezza e threat model
- [GDPR.md](docs/GDPR.md) - Compliance privacy
- [ROADMAP.md](ROADMAP.md) - Roadmap e stato avanzamento

## Dati

- **Real-time:** [5T Torino Open Data](https://opendata.5t.torino.it) - 40 parcheggi, aggiornamento ogni 2 minuti
- **Statici:** GTT (22 parcheggi con dettagli completi: tariffe, pagamenti, bus, metro)
- **Meteo:** [Open-Meteo](https://open-meteo.com) - condizioni attuali, no API key

## Licenza

MIT

## Autore

Marco Bellingeri - [@MK023](https://github.com/MK023)
