#!/bin/bash
# Start JAM Web UI in production mode (built)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/web"

# Build if needed
if [ ! -d ".next" ]; then
    echo "Building web application..."
    npm run build
fi

echo "Starting JAM Web UI (Production)"
echo "================================="
echo "URL: http://localhost:3000"
echo ""
echo "Note: Make sure API is running (uv run serve)"
echo "Press Ctrl+C to stop"
echo ""

npm run start
