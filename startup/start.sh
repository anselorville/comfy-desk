#!/bin/bash
# start.sh
# To run on Windows via Git Bash/WSL or Linux/Mac.

echo "=============================================="
echo "Starting ComfyDesk Local Services..."
echo "=============================================="

# Change directory to the parent folder
cd "$(dirname "$0")/.."

# Activate virtual environment if exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "[WARNING] .venv not found. Using system python..."
fi

# Define cleanup function to kill background processes on exit
cleanup() {
    echo ""
    echo "Stopping all services (ComfyUI, Gateway, Frontend)..."
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

echo "-> Starting ComfyUI Engine (Port 8188)..."
(cd comfy-ui && python main.py --listen 0.0.0.0 --port 8188) &

echo "-> Starting FastAPI Gateway (Port 8001)..."
(cd gateway && uvicorn main:app --reload --host 0.0.0.0 --port 8001) &

echo "-> Starting Next.js Frontend (Port 3000)..."
(cd frontend && npm run dev) &

echo "=============================================="
echo "[SUCCESS] All services started in background!"
echo "=============================================="
echo "* ComfyUI Engine  : http://localhost:8188"
echo "* FastAPI Gateway : http://localhost:8001"
echo "* Swagger API Docs: http://localhost:8001/api/docs (or /docs)"
echo "* Next.js Frontend: http://localhost:3000"
echo "=============================================="
echo "[NOTE] Press Ctrl+C to stop all services."
echo "=============================================="

# Wait for all background processes to keep terminal open
wait
