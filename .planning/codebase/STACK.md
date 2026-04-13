# STACK.md — Technology Stack

## Language & Runtime

| Layer | Language | Runtime |
|-------|----------|---------|
| Gateway (API) | Python 3.12 | CPython via `uv` |
| Frontend | TypeScript 5 | Node.js ≥ 20 LTS |
| Training scripts | Python 3.12 | CPython |
| Batch scripts | Python 3.12 | CPython (async) |
| Container orchestration | YAML | Docker Compose 3.9 |

Python version pinned in `.python-version` to `3.12`.

## Backend (Gateway) — Python

### Web Framework
- **FastAPI 0.115.6** — ASGI framework for all API routes
- **Uvicorn 0.32.1** (with `standard` extras) — ASGI server
- **Pydantic 2.10.3** — request/response validation and settings
- **pydantic-settings 2.7.0** — settings from `.env`

### HTTP / WebSocket Clients
- **httpx 0.28.1** — async HTTP client (ComfyUI REST + JoyCaption vLLM)
- **websockets 14.1** — async WebSocket client (ComfyUI execution events)
- **aiofiles 24.1.0** — async file I/O

### Image Processing
- **Pillow ≥ 11.0.0** — image encode/decode for caption payloads

### Middleware
- **FastAPI CORSMiddleware** — open CORS (`*`) for dev, needs tightening in prod

### Configuration
- `pydantic_settings.BaseSettings` reads from `.env`; see `gateway/config.py`
- Fields: `comfyui_url`, `joycaption_url`, `output_dir`, `gateway_api_key`, `joycaption_model`

## Frontend — Next.js / TypeScript

### Framework
- **Next.js 16.1.7** with App Router
- Output mode: `standalone` (for Docker container)
- **React 19.2.3** + React DOM 19.2.3
- **TypeScript 5**

### Styling
- **TailwindCSS 4** (`@tailwindcss/postcss`) — imported in `globals.css` via `@import "tailwindcss"`
- Custom CSS variables for design tokens (dark theme, purple accent)
- Google Fonts: **Inter** (via `next/font/google`)

### Lint
- ESLint 9 + `eslint-config-next` (core-web-vitals + TypeScript rules)

### Build
- `next build` → `.next/standalone/` for container
- `next dev` for local development

## ML / AI Stack

### ComfyUI (Image Generation Engine)
- Runs as a **separate Docker container** (`ghcr.io/ai-dock/comfyui:latest-cuda`)
- Accessed via HTTP (`/prompt`) and WebSocket (`/ws`) from the gateway
- Workflows are JSON files in `gateway/workflows/` with `__SENTINEL__` substitution
- Available workflows: `txt2img_sdxl`, `txt2img_flux`, `image_z_image_turbo`

### JoyCaption (Image Annotation)
- Runs as a **separate Docker container** (`vllm/vllm-openai:latest`)
- Served via **vLLM** as an OpenAI-compatible endpoint at port 8000
- Default model: `fancyfeast/llama-joycaption-beta-one-hf-llava`
- Accessed via `/v1/chat/completions` with base64-encoded image in the message

### PyTorch (Training)
- **torch 2.5.1** + **torchvision 0.20.1** + **torchaudio 2.5.1**
- CUDA 12.1 index: `https://download.pytorch.org/whl/cu121`
- Additional: `transformers ≥ 4.50.3`, `safetensors ≥ 0.4.2`, `einops`, `kornia ≥ 0.7.1`
- LoRA training delegated to external **kohya_ss** (`training/launch_lora.sh`)

## Infrastructure

### Container Build
- **Docker** + **Docker Compose 3.9**
- Services: `nginx`, `frontend`, `gateway`, `comfyui`, `joycaption`
- Network: single bridge `comfy_net`
- GPU: NVIDIA single-GPU (`count: 1`, `capabilities: [gpu]`)

### Volumes (host-bound)
- `${COMFYUI_MODELS_DIR}` → `/opt/ComfyUI/models` in comfyui container
- `${COMFYUI_OUTPUT_DIR}` → `/opt/ComfyUI/output` (shared with gateway + nginx)
- `${HF_CACHE_DIR}` → Hugging Face cache for JoyCaption model weights
- `${DATASET_DIR}` → dataset directory for training

### Reverse Proxy
- **Nginx 1.27-alpine**
- Routes: `/api/*` → gateway:8000, `/images/*` → static files, `/*` → frontend:3000

### Python Environment
- **uv** for package management (see `uv.lock`, `pyproject.toml`)
- Virtual environment at `.venv/`

## Key Version Constraints

| Package | Version |
|---------|---------|
| Python | ≥ 3.12 |
| FastAPI | 0.115.6 (pinned) |
| Pydantic | 2.10.3 (pinned) |
| httpx | 0.28.1 (pinned) |
| websockets | 14.1 (pinned) |
| torch | 2.5.1 (pinned, CUDA 12.1) |
| Next.js | 16.1.7 (pinned) |
| React | 19.2.3 (pinned) |
