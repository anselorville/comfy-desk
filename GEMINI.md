<!-- GSD:project-start source:PROJECT.md -->
## Project

**ComfyDesk**

ComfyDesk is a product-layer web application that wraps ComfyUI and a training backend into a unified, clean UI. It gives creators a purpose-built workstation for two workflows: **text-to-image generation** (via ComfyUI workflows) and **LoRA/finetune model training** (dataset management + kohya_ss/ai-toolkit). ComfyUI and training tools remain the engines; ComfyDesk is the product interface that orchestrates them.

**Core Value:** **A single clean UI that lets you generate images and train models on your local GPU — without touching the command line.**

### Constraints

- **Tech Stack**: Next.js + FastAPI + Docker Compose — extend existing stack, do not replace
- **GPU**: Single GPU, mutual exclusion required between generation and training workloads
- **Styling**: Fresh, minimal, clean aesthetic (不是暗黑heavy风格) — redesign current dark purple theme
- **Image viewing**: Must use a mature, polished image viewing solution (lightbox-quality)
- **Deployment**: Lightweight — avoid adding heavy infrastructure dependencies; no Redis or Postgres for v1 (enhance in-memory or use SQLite)
- **ComfyUI dependency**: ComfyUI must be running for generation; Desk does not manage ComfyUI's lifecycle in v1 (startup is manual or via Docker Compose)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Language & Runtime
| Layer | Language | Runtime |
|-------|----------|---------|
| Gateway (API) | Python 3.12 | CPython via `uv` |
| Frontend | TypeScript 5 | Node.js ≥ 20 LTS |
| Training scripts | Python 3.12 | CPython |
| Batch scripts | Python 3.12 | CPython (async) |
| Container orchestration | YAML | Docker Compose 3.9 |
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Python (Gateway & Training)
### Style
- **Python 3.12+** syntax — uses `str | None`, `dict[str, Any]`, and modern union types throughout
- No explicit formatter config (no `.ruff.toml`, `pyproject.toml` `[tool.ruff]`, `black.toml`)
- Type annotations on all function signatures in gateway code
- Docstrings present on most public functions and classes
### Async Pattern
- `httpx.AsyncClient` used for all HTTP calls (created per-request, not shared)
- `websockets.connect()` used as async context manager for WebSocket connections
- `asyncio.wait_for()` used for WebSocket timeout enforcement
### Separation of Concerns
- `api/` — thin route handlers: validate input, call service, return response
- `services/` — all business logic: external client calls, data manipulation
- `config.py` — settings only, no logic
### Error Handling
- HTTPExceptions for API-level errors (status codes + detail strings)
- `resp.raise_for_status()` on all external HTTP calls
- Background tasks use broad `except Exception as exc` with `logger.exception()` — updates task to FAILED
- No custom exception hierarchy
- WebSocket timeout uses `asyncio.TimeoutError` → logs warning, returns empty list (silent degradation)
### Logging
- Standard library `logging` via `logger = logging.getLogger(__name__)`
- Module-level logger per file
- Only gateway code uses logging; training scripts use `print()` / `tqdm`
### Configuration
- `pydantic_settings.BaseSettings` in `gateway/config.py`
- `settings` object imported directly by service modules
- Module-level constants derived from settings: `_COMFYUI_BASE = settings.comfyui_url`
### ArgParse (Training Scripts)
- All CLI arguments documented with `help=` strings
- `argparse.Namespace` passed around as `args`
- Comprehensive `--prompt`, `--prompts-file`, `--limit`, `--output-dir` patterns
## TypeScript / React (Frontend)
### Style
- **Strict TypeScript** (implied by `@types/react`, `@types/node`)
- All API data structures typed in `frontend/src/lib/api.ts`
- `"use client"` directive for components using hooks (`NavBar.tsx`)
- No `"use server"` yet (API route is a plain Route Handler)
### Component Pattern
- Functional components only (no class components)
- Inline styles used heavily (not Tailwind utility classes in JSX, despite Tailwind being installed)
- CSS custom properties (`var(--accent)`, `var(--bg-card)`) for theming
- Mobile media queries added as `<style>` JSX tags at component bottom
### API Layer (`frontend/src/lib/api.ts`)
- Pure async functions, no framework-specific data fetching (no SWR, React Query, etc.)
- Explicit `fetch()` calls with error propagation via `throw new Error(await res.text())`
- Polling helper `waitForTask()` uses `setInterval` wrapped in a `Promise`
- Interval: 1500ms polling cycle
### State Management
- Local `useState` per page, no shared global state
- Task polling results stored in local component state
### Theming (Design System)
## Workflow Sentinel Convention
## Docker Conventions
- All service names: lowercase (`nginx`, `gateway`, `comfyui`, `joycaption`, `frontend`)
- Container names prefixed: `comfydesk_<service>`
- `env_file: .env` only on `gateway` service (others use explicit `environment:` keys)
- Volumes use host-bound bind mounts (`type: none`, `o: bind`) for easy file access
## Git Conventions
- Conventional commit messages (mix of English and Chinese in history)
- `.gitignore` excludes: `.venv/`, `node_modules/`, `volumes/`, `__pycache__/`, `*.safetensors`, `*.ckpt`, `.env`
- Project has only 2 commits in history so far — early stage
## Language Mix (UI)
- NavBar: `生成` (Generate), `画廊` (Gallery), `标注` (Caption)
- GET-STARTED.md guide is fully in Chinese
- English used for: code, API endpoints, configuration keys, AGENT.md
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Architectural Pattern
```
```
## Data Flow — Image Generation
```
```
## Data Flow — Image Captioning
```
```
## Data Flow — Gallery
```
```
## Service Boundaries
| Service | Responsibility | Knows About |
|---------|---------------|-------------|
| `nginx` | Routing, static serving, SSL termination point | frontend, gateway, output volume |
| `frontend` | UI rendering, user interaction, gallery | gateway API only |
| `gateway` | Business logic, workflow orchestration, task state | ComfyUI, JoyCaption |
| `comfyui` | ML inference, node graph execution | model weights only |
| `joycaption` | Vision-language captioning | HF model weights only |
## Key Abstractions
### Task System (`gateway/services/task_store.py`)
- **In-memory dict** `_store: dict[str, Task]`
- `Task` dataclass: `id`, `status` (enum), `progress` (0-100), `images`, `error`, `params`
- `TaskStatus`: `PENDING → RUNNING → DONE | FAILED`
- No persistence — tasks lost on gateway restart
- Comment in code: "Replace with Redis-backed store for multi-worker scalability"
### Workflow Template Engine (`gateway/services/workflow_loader.py`)
- Loads ComfyUI API-format JSON from `gateway/workflows/`
- Deep-clones workflow, replaces `__KEY__` sentinel strings with runtime values
- Case-insensitive key matching (lowercased)
- Same logic reimplemented in `scripts/generate_z_image_batch.py` (duplication)
### ComfyUI Client (`gateway/services/comfy_client.py`)
- Thin async wrapper around ComfyUI HTTP + WebSocket APIs
- `queue_prompt()` → fires-and-forgets a workflow
- `wait_for_completion()` → blocks until prompt finishes or 300s timeout
- `get_image_bytes()` → downloads result image
- `get_system_stats()` → health check
### Caption Client (`gateway/services/caption_client.py`)
- Thin async wrapper around vLLM OpenAI-compatible API
- Style → system prompt mapping (`CAPTION_PROMPTS` dict)
- Always re-encodes image as JPEG before sending (normalization)
## Entry Points
| Entry Point | Command | Purpose |
|-------------|---------|---------|
| `gateway/main.py` | `uvicorn main:app --reload` | FastAPI API gateway |
| `frontend/` | `npm run dev` | Next.js dev server |
| `docker-compose.yml` | `docker compose up -d --build` | Full stack |
| `training/prepare_dataset.py` | `python prepare_dataset.py` | Dataset caption generation |
| `training/resize_images.py` | `python resize_images.py` | Image preprocessing |
| `training/verify_dataset.py` | `python verify_dataset.py` | Dataset validation |
| `training/launch_lora.sh` | `bash launch_lora.sh` | LoRA training via kohya_ss |
| `scripts/generate_z_image_batch.py` | `python generate_z_image_batch.py` | Batch image generation |
## Frontend Architecture
```
```
## State Management
- **No global state library** (no Redux, Zustand, etc.)
- Per-page local `useState` / `useEffect` hooks
- Task polling implemented via `setInterval` in `waitForTask()` in `frontend/src/lib/api.ts`
- Task store on backend is in-memory only
## GPU Resource Sharing
- Both ComfyUI and JoyCaption share a **single GPU** via Docker time-slicing
- JoyCaption allocated 45% GPU memory (`--gpu-memory-utilization 0.45`)
- ComfyUI gets remainder (~55%)
- JoyCaption has `shm_size: "8gb"` and `ipc: host` for multi-process memory sharing
- README documents the manual stop-one strategy during OOM conditions
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
