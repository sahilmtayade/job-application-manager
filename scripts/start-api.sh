#!/bin/bash
# Start JAM API server only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Activate conda environment
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate jam

echo "Starting JAM API"
echo "================"
echo "API:   http://localhost:8000"
echo "Docs:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"

uvicorn api.main:app --port 8000
