# 🅿️ Torino Parking - Real-Time Parking Availability API

Backend API per visualizzare disponibilità parcheggi in tempo reale a Torino.

## 📋 Panoramica Progetto

Applicazione che aggrega dati real-time dall'API Open Data 5T del Comune di Torino per fornire informazioni su disponibilità parcheggi tramite API REST performante e sicura.

### Obiettivi
- ✅ Fornire API REST per app mobile (iOS/Android)
- ✅ Cache intelligente per performance
- ✅ Storico dati per analytics e predizioni
- ✅ Architettura scalabile e production-ready
- ✅ GDPR compliant
- ✅ Security-first approach

### Stack Tecnologico

**Backend:**
- FastAPI (Python 3.12)
- PostgreSQL 16 + PostGIS (geo-spatial queries)
- Redis 7 (caching + Celery broker)
- Celery (background tasks)
- Docker + Docker Compose

**Monitoring & Observability:**
- Sentry (error tracking)
- Prometheus + Grafana (metrics)
- Structured logging

**Deployment:**
- Docker containerizzato
- Dockhand (Docker management UI)
- CI/CD con GitHub Actions
- Fly.io (hosting)

## 🗂️ Struttura Documentazione

Tutta la documentazione dettagliata è nella cartella `/docs`:

### Core Documentation
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Architettura completa del sistema
- **[SECURITY.md](docs/SECURITY.md)** - Threat model, autenticazione, security best practices
- **[GDPR.md](docs/GDPR.md)** - Compliance GDPR, privacy policy, data protection
- **[API_DESIGN.md](docs/API_DESIGN.md)** - Design API RESTful, endpoints, patterns
- **[DATABASE.md](docs/DATABASE.md)** - Schema database, migrations, queries geografiche

### Development & Operations
- **[SETUP.md](docs/SETUP.md)** - Setup locale, installazione, quick start
- **[BEST_PRACTICES.md](docs/BEST_PRACTICES.md)** - Code quality, testing, performance
- **[CELERY.md](docs/CELERY.md)** - Background tasks, scheduled jobs, workers
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deploy con Dockhand, CI/CD, monitoring

### Reference
- **[TECH_DECISIONS.md](docs/TECH_DECISIONS.md)** - ADR (Architecture Decision Records)
- **[ALGORITHMS.md](docs/ALGORITHMS.md)** - Algoritmi geo-spatial, predictions
- **[TOOLS.md](docs/TOOLS.md)** - Setup Claude Code, VS Code extensions, CLI tools

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/yourusername/torino-parking.git
cd torino-parking

# 2. Copy environment variables
cp .env.example .env
# Edit .env con i tuoi secrets

# 3. Start con Docker Compose
docker-compose up -d

# 4. Verifica che tutto funzioni
curl http://localhost:8000/health
```

L'API sarà disponibile su `http://localhost:8000`

Documentazione interattiva (Swagger): `http://localhost:8000/docs`

## 📊 Features Pianificate

### MVP (Fase 1) - In sviluppo
- [x] Architettura definita
- [x] Documentazione completa
- [ ] API 5T client
- [ ] Endpoint `/parkings` con cache Redis
- [ ] Health checks
- [ ] Docker setup completo

### v1.0 (Fase 2)
- [ ] Geo-spatial search (parcheggi entro N km)
- [ ] Celery background tasks
- [ ] Storico disponibilità (PostgreSQL)
- [ ] Rate limiting multi-tier
- [ ] GDPR endpoints completi

### v2.0 (Fase 3)
- [ ] Predizioni ML (availability forecast)
- [ ] Push notifications
- [ ] Admin dashboard
- [ ] Multi-città support

## 🔐 Security & Compliance

- ✅ GDPR compliant by design
- ✅ Data minimization (NO targhe, NO PII non necessari)
- ✅ Encryption at rest e in transit
- ✅ Rate limiting per abuse prevention
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Vulnerability scanning (Trivy)
- ✅ Audit logging

Vedi [SECURITY.md](docs/SECURITY.md) per dettagli completi.

## 📝 License

MIT License - vedi [LICENSE](LICENSE) file.

## 👥 Contributing

Per ora progetto personale. Contributioni benvenute in futuro!

## 📞 Contatti

Marco Bellingeri
- GitHub: [@marcobellingeri](https://github.com/marcobellingeri)
- Email: [your-email]

---

**Nota per Claude Code:** Tutta la documentazione necessaria per sviluppare il progetto è nella cartella `/docs`. Leggi i file in ordine per avere contesto completo su architettura, security e best practices da seguire.
