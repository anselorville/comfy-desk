# ComfyDesk

ComfyUI-based text-to-image platform with JoyCaption annotation, API service, LoRA training pipeline, and mobile-friendly Next.js UI.

## Architecture

```
Browser / Mobile
       │
    Nginx :80
    ├── /api/*     → FastAPI Gateway
    ├── /images/*  → ComfyUI output (static)
    └── /*         → Next.js Frontend
         │
    FastAPI Gateway
    ├── ComfyUI client (WebSocket + HTTP)
    └── JoyCaption client (vLLM OpenAI API)
         │
    ┌────┴─────┐
ComfyUI :8188  vLLM/JoyCaption :8000
```

## GPU Requirements

- **GPU**: 1x GPU with ≥ 16GB VRAM (tested on RTX 2080 Ti 22GB)
- **JoyCaption** (vLLM): ~10GB VRAM
- **ComfyUI + SDXL**: ~5-8GB VRAM
- Both fit in 22GB; for very large batches, stop one service during the other's execution

## Repository Layout & Git Boundary

This repo tracks **only the desk shell**: `frontend/`, `gateway/`, `training/`,
`nginx/`, `startup/`, `scripts/`, docker/nginx configs, docs. The ComfyUI
engine lives at `comfy-ui/` and is **never committed** — it is pulled from
upstream and kept current with one command:

```bash
bash startup/bootstrap-comfyui.sh   # clone-or-update comfy-ui + uv sync (.venv)
```

Dependencies are unified in root `pyproject.toml` + `uv.lock` (engine AND
gateway together); `.venv/` is materialized by `uv sync --frozen`.

## Capability Skills (Plugin Layer)

Workflows are raw execution graphs; **skills** are the product-facing
capabilities built on top of them. A skill binds a workflow + scenario metadata
+ prompt template + parameter defaults into a reusable JSON plugin under
`gateway/skills/` — additive, no gateway code changes, no restart:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/skills` | List registered capability skills |
| `POST` | `/api/v1/skills` | **Register a new skill from an existing workflow** |
| `POST` | `/api/v1/skills/{id}/run` | Execute a skill (defaults ← overrides → templates) |
| `DELETE` | `/api/v1/skills/{id}` | Remove a skill plugin |
| `POST` | `/api/v1/workflows` | Register a new ComfyUI API-format workflow |
| `GET`  | `/api/v1/artifacts` | Collected platform artifacts (task outputs) |

Typical automation loop (LLM agent / external tool):

```bash
# 1. Generate a workflow graph for a requirement, register it:
curl -X POST http://localhost/api/v1/workflows -d '{"name":"my_graph","title":"My Graph","workflow":{...}}'
# 2. Encapsulate it as a scenario capability:
curl -X POST http://localhost/api/v1/skills -d '{"name":"Product Shot","workflow":"my_graph","prompt_template":"{subject}, studio product photo","defaults":{"steps":28}}'
# 3. Run it; collect results from the artifact feed:
curl -X POST http://localhost/api/v1/skills/product-shot/run -d '{"params":{"subject":"ceramic teapot"}}'
```

```bash
# 1. Clone and configure
git clone https://github.com/yourname/comfy-desk
cd comfy-desk
cp .env.example .env

# 2. Create volume directories
mkdir -p volumes/models/checkpoints volumes/models/loras volumes/models/unet
mkdir -p volumes/output volumes/hf_cache volumes/dataset

# 3. Build and start all services
docker compose up -d --build

# 4. Open in browser
http://localhost       # Main UI
http://localhost/api/docs  # API docs (Swagger)
```

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/generate` | Submit text-to-image task |
| `GET`  | `/api/v1/tasks/{id}` | Poll task status + image URLs |
| `POST` | `/api/v1/caption` | Upload image → JoyCaption text |
| `GET`  | `/api/v1/workflows` | List workflow templates |
| `GET`  | `/api/docs` | Swagger UI |

### Generate example

```bash
curl -X POST http://localhost/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a stunning portrait, golden hour, bokeh, photorealistic",
    "workflow": "txt2img_sdxl",
    "steps": 28,
    "cfg": 7.0,
    "width": 1024, "height": 1024
  }'
# → {"task_id": "abc-123", "status": "pending"}

curl http://localhost/api/v1/tasks/abc-123
# → {"status": "done", "images": ["/images/comfydesk/xyz.png"], ...}
```

## Models Setup

### SDXL (default)

Place `sd_xl_base_1.0.safetensors` in `volumes/models/checkpoints/`

### Flux.1-dev

```
volumes/models/unet/flux1-dev.safetensors
volumes/models/clip/t5xxl_fp8_e4m3fn.safetensors
volumes/models/clip/clip_l.safetensors
volumes/models/vae/ae.safetensors
```

### LoRA weights

Place `.safetensors` files in `volumes/models/loras/`

## Training Pipeline

### 1. Prepare dataset (batch captioning)

```bash
cd training
pip install httpx pillow
python prepare_dataset.py \
  --input  ./raw_images/ \
  --output ./train_dataset/ \
  --style  training \
  --api    http://localhost/api/v1
```

### 2. Install kohya_ss

```bash
git clone https://github.com/bmaltais/kohya_ss ../kohya_ss
cd ../kohya_ss && pip install -r requirements.txt
```

### 3. Launch LoRA training

```bash
cd training

# SDXL LoRA
./launch_lora.sh --model sdxl --dataset ./train_dataset --name my_character

# Flux LoRA
./launch_lora.sh --model flux --dataset ./train_dataset --name my_flux_lora
```

### 4. Deploy LoRA

```bash
cp ./lora_output/my_character.safetensors volumes/models/loras/
```

Then use it in generation:
```json
{"prompt": "my_character, ...", "lora": "my_character", "lora_strength": 0.8}
```

## Workflow Templates

Located in `gateway/workflows/`:

| File | Description |
|------|-------------|
| `txt2img_sdxl.json` | SDXL text-to-image + LoRA support |
| `txt2img_flux.json` | Flux.1-dev text-to-image (fp8, 22GB) |

Add your own ComfyUI API-format JSON files here to expose them via the `/api/v1/workflows` endpoint.

## Development (without Docker)

```bash
# FastAPI gateway (local)
cd gateway
pip install -r requirements.txt
COMFYUI_URL=http://localhost:8188 JOYCAPTION_URL=http://localhost:8000 uvicorn main:app --reload

# Next.js frontend
cd frontend
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1 npm run dev
```

## Directory Structure

```
comfy-desk/
├── docker-compose.yml       # Full stack orchestration
├── .env.example             # Environment variables template
├── nginx/nginx.conf         # Reverse proxy
├── gateway/                 # FastAPI API service
│   ├── api/                 # Route handlers
│   ├── services/            # ComfyUI & JoyCaption clients
│   ├── workflows/           # ComfyUI workflow JSON templates
│   └── requirements.txt
├── frontend/                # Next.js UI (App Router)
│   └── src/app/
│       ├── page.tsx         # Generate page
│       ├── gallery/         # Gallery page
│       └── caption/         # JoyCaption annotation page
├── training/
│   ├── prepare_dataset.py   # Batch image captioning
│   └── launch_lora.sh       # LoRA training launcher (SDXL + Flux)
└── volumes/                 # (gitignored) host-mounted data
    ├── models/
    ├── output/
    ├── hf_cache/
    └── dataset/
```
