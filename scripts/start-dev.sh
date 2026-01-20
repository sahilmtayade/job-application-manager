#!/bin/bash
# Start JAM Web UI in development mode (hot reload)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/web"

echo "Starting JAM Web UI (Development)"
echo "=================================="
echo "URL: http://localhost:3000"
echo ""
echo "Note: Make sure API is running (./scripts/start-api.sh)"
echo "Press Ctrl+C to stop"
echo ""

npm run dev
