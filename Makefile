COMPOSE_DEV  = docker-compose.dev.yml
COMPOSE_PROD = docker-compose.prod.yml
PROJECT      = terroir

# ─── Desarrollo ────────────────────────────────────────────────────────────────

up-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev up --build

up-dev-watch:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev up --build --watch

down-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev down

restart-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev restart

restart-backend:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev restart backend

logs-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev logs -f

logs-backend:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev logs -f backend

ps-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev ps

clean-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev down --volumes

destroy-dev:
	docker compose -f $(COMPOSE_DEV) -p $(PROJECT)_dev down --volumes --rmi all

# ─── Producción ────────────────────────────────────────────────────────────────

up-prod:
	docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod up -d --build

down-prod:
	docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod down

logs-prod:
	docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod logs -f

ps-prod:
	docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod ps

clean-prod:
	docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod down --volumes

destroy-prod:
	docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod down --volumes --rmi all

# Build imagen prod directamente (para Cloud Run / GCR)
build-prod:
	DOCKER_BUILDKIT=1 docker compose -f $(COMPOSE_PROD) -p $(PROJECT)_prod build

build-image:
	docker build -f Dockerfile.prod -t terroir-backend:latest .

# ─── Base de datos ─────────────────────────────────────────────────────────────

migrate-dev:
	docker exec -it terroir_backend npx prisma migrate dev

migrate-deploy:
	docker exec -it terroir_backend npx prisma migrate deploy

studio:
	docker exec -it terroir_backend npx prisma studio --port 5555 --browser none

generate:
	docker exec -it terroir_backend npx prisma generate

seed:
	docker exec -it terroir_backend npm run seed

# ─── Shells ────────────────────────────────────────────────────────────────────

shell:
	docker exec -it terroir_backend bash

shell-db:
	docker exec -it terroir_postgres psql -U $(shell grep POSTGRES_USER .env | cut -d= -f2) \
	  -d $(shell grep POSTGRES_DB .env | cut -d= -f2)

# ─── Utilidades ────────────────────────────────────────────────────────────────

stats:
	docker stats

prune:
	docker system prune -a --volumes

.PHONY: help
help:
	@echo ""
	@echo "  Terroir Backend — Comandos Docker"
	@echo ""
	@echo "  Desarrollo:"
	@echo "    make up-dev           Levanta todo con build (postgres + mailpit + backend)"
	@echo "    make up-dev-watch     Igual + hot-reload con docker compose watch"
	@echo "    make down-dev         Para los contenedores"
	@echo "    make restart-backend  Reinicia solo el backend"
	@echo "    make logs-backend     Logs del backend en tiempo real"
	@echo "    make clean-dev        Para y borra volúmenes"
	@echo ""
	@echo "  Base de datos:"
	@echo "    make migrate-dev      Crea/aplica migraciones (desarrollo)"
	@echo "    make migrate-deploy   Aplica migraciones (producción)"
	@echo "    make studio           Abre Prisma Studio en :5555"
	@echo "    make seed             Ejecuta el seed"
	@echo ""
	@echo "  Producción:"
	@echo "    make up-prod          Levanta en modo prod con .env.prod"
	@echo "    make build-image      Build imagen Docker para Cloud Run"
	@echo ""
	@echo "  Shells:"
	@echo "    make shell            Accede al contenedor backend"
	@echo "    make shell-db         Accede a psql"
	@echo ""
