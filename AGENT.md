# Comfy-Desk Project Agent Guidelines

Welcome to the `comfy-desk` project. This document serves as the global context and directive instruction for AI coding assistants working in this repository.

## 1. Project Overview
**Comfy-Desk** is a comprehensive Text-to-Image generation platform built on top of ComfyUI. 
It aims to provide a user-friendly API gateway, a modern web frontend, and integrated capabilities for image generation, JoyCaption-based image annotation, and LoRA training pipelines (via `kohya_ss`).

## 2. Tech Stack Setup
- **Frontend**: Next.js + React (TypeScript/TSX).
- **Backend / Gateway**: Python (FastAPI). Bridges the gap between the frontend UI and the underlying local tools.
- **Engines & Tools**:
  - **ComfyUI**: Core image generation engine (using SDXL / Flux workflows).
  - **JoyCaption**: Utilized for image tagging and captioning.
  - **Kohya_ss**: Used for the LoRA training pipeline.
- **Deployment**: Docker, `docker-compose`, Nginx as reverse proxy.

## 3. Directory Structure
Ensure any new code is placed in its proper bounded context based on the following structure:
- `/frontend/`: Contains the Next.js frontend code. No Python engine logic here.
- `/gateway/`: Contains the Python backend (FastAPI) responsible for API routing (`api/`), services (`services/`), and Docker definitions.
- `/gateway/workflows/`: Stores ComfyUI exported workflows in `.json` format.
- `/training/`: Scripts related to dataset preparation, validation (`verify_dataset.py`, `resize_images.py`), and model training.
- `/gateway/skills/`: Skill plugin store — one JSON per capability skill
  (workflow + scenario metadata + prompt template + defaults). Additive.
- `/nginx/`: Nginx proxy configuration for routing traffic properly.
- `/comfy-ui/`: (Ignored in Git) The actual ComfyUI engine, pulled from upstream
  via `bash startup/bootstrap-comfyui.sh`. NEVER commit engine code.
  - `/ComfyUI/`, `/comfyui/` variants are also ignored — the boundary is absolute.
  - `/.venv/`: (Ignored in Git) Python virtual environment, materialized by `uv sync --frozen`
    from the unified root `pyproject.toml` + `uv.lock` (engine + gateway deps together).

## 4. Development Principles

### 4.1. Gateway (Python/FastAPI)
- **Async First**: Use asynchronous handling (`async`/`await`) when making HTTP requests to ComfyUI or handling long-running task operations.
- **Separation of Concerns**: Endpoint routing (`api/`) should not contain business logic; defer it to handlers in (`services/`).
- **Workflow Management**: Rely on `gateway/workflows/*.json` to build ComfyUI requests dynamically rather than hardcoding complex node graphs in Python.
- **Capability Skills**: Product-facing capabilities are skills (`gateway/skills/*.json`), not code. New scenario features = register a workflow + bind a skill via API; keep business logic out of skill files.
- **Engine Boundary**: `comfy-ui/` is external. Update it only through `startup/bootstrap-comfyui.sh`; never reference engine internals from gateway/frontend code.

### 4.2. Frontend (Next.js/React)
- **Aesthetic First**: Prioritize modern, clean, UI/UX designs. Use proper component structuring.
- **Type Safety**: Strictly adhere to TypeScript interfaces for inputs and API responses. 

### 4.3. Scripting & Training (`/training/`)
- Always validate dataset integrity (shapes, extensions, corruptions) before initiating training commands.
- Provide comprehensive logging and CLI arguments handling using `argparse`.

### 4.4. State & Task Management
- Generation and Training are slow processes. The platform relies heavily on **Task IDs**. 
- Always ensure state sync logic (polling or WebSockets) handles connection drops gracefully.

## 5. Git & Contributions
- Validate against `.gitignore` before executing `git add` to avoid committing large folders (e.g., `.venv`, `comfy-ui/`, `frontend/node_modules/`, `*.safetensors`). The engine checkout (`comfy-ui/`) must NEVER enter this repo's history — provision/update it with `bash startup/bootstrap-comfyui.sh`.
- Provide human-readable, context-rich commit messages.
