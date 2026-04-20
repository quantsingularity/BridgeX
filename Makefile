# BridgeX - Open Banking Connector

.PHONY: help up down down-v logs test test-server

help:
	@echo ""
	@echo "  BridgeX - Open Banking Connector"
	@echo "  ─────────────────────────────────────────────────────"
	@echo "  make up           Start full stack"
	@echo "  make down         Stop containers"
	@echo "  make down-v       Stop + wipe volumes"
	@echo "  make test         Run Jest unit tests"
	@echo "  make logs         Tail all logs"
	@echo ""
	@echo "  After 'make up':"
	@echo "    API:       http://localhost:4000"
	@echo "    Dashboard: http://localhost:3000"
	@echo "    Docs:      docs/openapi.yaml"
	@echo ""

up:
	@cp -n .env.example .env 2>/dev/null || true
	docker compose up -d --build
	@echo ""
	@echo "  BridgeX is starting..."
	@echo "  API:       http://localhost:4000"
	@echo "  Admin UI:  http://localhost:3000"

down:
	docker compose down

down-v:
	docker compose down -v

logs:
	docker compose logs -f

logs-%:
	docker compose logs -f $*

ps:
	docker compose ps

test:
	cd server && npm install && npm test

build-%:
	docker compose up -d --build $*
