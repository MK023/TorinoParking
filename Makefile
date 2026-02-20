.PHONY: up down restart logs status test lint clean shell migrate help

up:                  ## Avvia TorinoParking (Doppler + health checks)
	@./scripts/start.sh

down:                ## Ferma tutti i servizi (preserva volumi)
	@docker compose down
	@echo "Servizi fermati. Volumi preservati."

restart: down up     ## Restart completo

logs:                ## Log live di tutti i servizi
	docker compose logs -f

logs-%:              ## Log di un servizio (es. make logs-backend)
	docker compose logs -f $*

status:              ## Stato dei container
	@docker compose ps

shell:               ## Shell nel backend container
	docker compose exec backend bash

migrate:             ## Esegui migrations Alembic
	docker compose exec backend alembic upgrade head

test:                ## Esegui pytest nel backend
	docker compose exec backend python -m pytest tests/ -v

lint:                ## Linting Python + TypeScript
	docker compose exec backend ruff check app/ tests/
	docker compose exec frontend npx tsc --noEmit

clean:               ## Ferma tutto e rimuovi volumi (DB reset)
	@docker compose down -v
	@echo "Volumi rimossi. 'make up' ricrea tutto da zero."

help:                ## Mostra i comandi disponibili
	@grep -E '^[a-zA-Z_%-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
