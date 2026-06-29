#!/usr/bin/env bash
#
# BridgeX - one-command launcher
#
# Usage:
#   ./start.sh           Start the full stack with Docker Compose (recommended)
#   ./start.sh --down    Stop the stack
#   ./start.sh --logs    Tail logs
#   ./start.sh --local   Run server + frontend locally without Docker
#                        (requires a reachable Postgres + Redis; see .env)
#
set -euo pipefail
cd "$(dirname "$0")"

# Ensure a .env exists (all defaults work out of the box).
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

case "${1:-up}" in
  --down)
    docker compose down
    ;;
  --logs)
    docker compose logs -f
    ;;
  --local)
    echo "Starting BridgeX locally (no Docker)..."
    echo "Make sure Postgres and Redis are running and match DATABASE_URL / REDIS_URL in .env."
    (
      cd server
      npm install
      npm run build
      node dist/index.js &
      echo $! > /tmp/bridgex_server.pid
    )
    (
      cd frontend
      npm install
      npm run dev
    )
    ;;
  up|*)
    echo "Starting BridgeX with Docker Compose..."
    docker compose up -d --build
    echo ""
    echo "  BridgeX is starting."
    echo "  API:        http://localhost:4000"
    echo "  Health:     http://localhost:4000/health"
    echo "  Admin UI:   http://localhost:3000"
    echo ""
    echo "  Tail logs:  ./start.sh --logs"
    echo "  Stop:       ./start.sh --down"
    ;;
esac
