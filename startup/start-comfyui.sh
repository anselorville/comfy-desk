#!/bin/bash
# start-comfyui.sh
# Start only the local ComfyUI engine.

set -e

echo "=============================================="
echo "Starting ComfyUI Locally..."
echo "=============================================="

# Change directory to the project root so relative paths work.
cd "$(dirname "$0")/.."

if [ ! -d "comfy-ui" ]; then
    echo "[INFO] comfy-ui not found — bootstrapping engine (clone + env sync) ..."
    bash "$(dirname "$0")/bootstrap-comfyui.sh"
fi

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "[ERROR] .venv not found. You need to set it up first."
    exit 1
fi

echo "-> Starting ComfyUI Engine (Port 8188)..."
cd comfy-ui
python main.py --listen 0.0.0.0 --port 8188
