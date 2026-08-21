#!/usr/bin/env bash
# bootstrap-comfyui.sh — provision or update the internal ComfyUI engine.
#
# Repository boundary: this repo (comfy-desk) only tracks the desk shell
# (frontend/, gateway/, training/, nginx/, startup/, scripts/). The ComfyUI
# engine lives at ./comfy-ui and is gitignored — it is pulled from upstream
# and never committed here.
#
# Usage:
#   bash startup/bootstrap-comfyui.sh            # clone if missing, else git pull
#   COMFYUI_REPO=<url> bash startup/bootstrap-comfyui.sh   # custom engine repo
set -euo pipefail
cd "$(dirname "$0")/.."

ENGINE_REPO="${COMFYUI_REPO:-https://github.com/comfyanonymous/ComfyUI}"
ENGINE_DIR="comfy-ui"

if [ -d "$ENGINE_DIR/.git" ]; then
    echo "-> Updating engine at ./$ENGINE_DIR ..."
    git -C "$ENGINE_DIR" pull --ff-only
else
    if [ -d "$ENGINE_DIR" ]; then
        echo "[WARN] ./$ENGINE_DIR exists but is not a git checkout — replacing it."
        rm -rf "$ENGINE_DIR"
    fi
    echo "-> Cloning engine $ENGINE_REPO -> ./$ENGINE_DIR ..."
    git clone --depth 1 "$ENGINE_REPO" "$ENGINE_DIR"
fi

# Unified environment: root pyproject.toml + uv.lock is the single source of
# truth for BOTH engine and gateway dependencies.
if command -v uv >/dev/null 2>&1; then
    echo "-> Syncing unified environment (.venv) ..."
    uv sync --frozen
elif [ ! -f ".venv/bin/activate" ] && [ ! -f ".venv/Scripts/activate" ]; then
    echo "[WARN] uv not found and no .venv present."
    echo "       Install uv (https://docs.astral.sh/uv/), then re-run this script."
fi

echo "[OK] Engine ready: ./$ENGINE_DIR ($(git -C "$ENGINE_DIR" rev-parse --short HEAD))"
