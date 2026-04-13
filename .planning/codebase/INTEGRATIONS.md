# INTEGRATIONS.md — External Services & APIs

## ComfyUI (Image Generation Engine)

### Connection
- **Protocol**: HTTP REST + WebSocket
- **Default URL**: `http://comfyui:8188` (Docker) / `http://localhost:8188` (local dev)
- **Config key**: `settings.comfyui_url` in `gateway/config.py`

### REST Endpoints Used
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/prompt` | Submit a ComfyUI workflow for execution |
| GET | `/view` | Download an output image by filename |
| GET | `/system_stats` | Health/stats check |
| GET | `/history/{prompt_id}` | Retrieve execution history (used by batch script) |

### WebSocket Endpoint
- **Path**: `/ws?clientId={client_id}`
- **Purpose**: Stream execution events — `executing`, `executed` messages
- **Pattern**: Connect after queuing a prompt; wait for `type=executing` with `node=null` to signal completion; collect image filenames from `type=executed` messages
- **Client**: `gateway/services/comfy_client.py` — `wait_for_completion()`
- **Timeout**: 300 seconds (hardcoded in gateway)

### Workflow Format
- ComfyUI API-format JSON with sentinel string substitution
- Sentinels: `__POSITIVE_PROMPT__`, `__WIDTH__`, `__STEPS__`, etc.
- Injected by `gateway/services/workflow_loader.py` — `inject_params()`
- Templates stored in `gateway/workflows/` and `scripts/` directories

---

## JoyCaption via vLLM (Image Captioning)

### Connection
- **Protocol**: HTTP, OpenAI-compatible API
- **Default URL**: `http://joycaption:8000` (Docker) / `http://localhost:8000` (local)
- **Config key**: `settings.joycaption_url`, `settings.joycaption_model`

### Endpoint Used
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/chat/completions` | Send image + prompt, receive caption |

### Request Pattern (`gateway/services/caption_client.py`)
```python
payload = {
    "model": _MODEL,
    "messages": [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<b64>"}},
            {"type": "text", "text": system_prompt},
        ]
    }],
    "max_tokens": max_tokens,
    "temperature": temperature,
}
```

### Caption Styles
| Style | Use Case |
|-------|----------|
| `descriptive` | Natural language description |
| `tags` | Comma-separated SD tags (default) |
| `short` | One-sentence summary |
| `training` | LoRA dataset tagging format |

---

## Hugging Face (Model Weights)

- **Usage**: Downloading JoyCaption model weights at container startup via vLLM
- **Model**: `fancyfeast/llama-joycaption-beta-one-hf-llava` (configurable)
- **Auth**: Optional `HF_TOKEN` env var for gated models
- **Cache**: `${HF_CACHE_DIR}` volume → `/root/.cache/huggingface`

---

## PyTorch Index — NVIDIA CUDA

- **URL**: `https://download.pytorch.org/whl/cu121`
- **Purpose**: Downloads GPU-accelerated PyTorch wheels (CUDA 12.1)
- **Used by**: `pyproject.toml` for gateway + training dependencies

---

## Kohya_ss (LoRA Training — External)

- **Type**: External tool, not managed by Docker Compose
- **Integration point**: `training/launch_lora.sh` — shell script that calls kohya_ss CLI
- **Input**: Processed dataset in `.txt`/image pair format (produced by `training/prepare_dataset.py`)
- **No API**: pure CLI invocation, run manually

---

## Frontend → Gateway API

### Base URL
- Docker: `NEXT_PUBLIC_API_BASE=/api/v1` (relative, via Nginx)
- Local dev: `NEXT_PUBLIC_API_BASE=http://localhost:8001/api/v1`
- Fallback: `http://localhost/api/v1`

### Requests Made by Frontend (`frontend/src/lib/api.ts`)
| Call | Method | Endpoint |
|------|--------|----------|
| `generate()` | POST | `/api/v1/generate` |
| `pollTask()` | GET | `/api/v1/tasks/{task_id}` |
| `waitForTask()` | GET (polling loop) | `/api/v1/tasks/{task_id}` every 1500ms |
| `captionImage()` | POST multipart | `/api/v1/caption` |
| `listWorkflows()` | GET | `/api/v1/workflows` |

### Frontend Gallery API (Next.js Route Handler)
- **Path**: `frontend/src/app/api/gallery/route.ts`
- **Source**: Reads `OUTPUT_DIR` directory directly from filesystem (container volume mount)
- **Returns**: `{ images: [{ name, src: "/images/<name>" }] }` — newest first

---

## Nginx (Reverse Proxy)

### Routing Rules (`nginx/nginx.conf`)
| Path | Target | Notes |
|------|--------|-------|
| `/api/*` | `gateway:8000` | 300s proxy timeout for generation |
| `/images/*` | Filesystem alias `/var/comfydesk/output/` | 7-day cache headers |
| `/*` | `frontend:3000` | Next.js app |

### Max Body Size
- `client_max_body_size 50m` — matches caption API 50MB limit

---

## Environment Variables (Key Config)

| Variable | Default | Purpose |
|----------|---------|---------|
| `COMFYUI_URL` | `http://comfyui:8188` | Gateway → ComfyUI |
| `JOYCAPTION_URL` | `http://joycaption:8000` | Gateway → JoyCaption |
| `GATEWAY_API_KEY` | `""` (disabled) | Optional bearer auth on gateway |
| `JOYCAPTION_MODEL` | `fancyfeast/...beta-one...` | vLLM model name |
| `JOYCAPTION_GPU_UTIL` | `0.45` | GPU fraction for JoyCaption |
| `HF_TOKEN` | `""` | Hugging Face access token |
| `NEXT_PUBLIC_API_BASE` | `/api/v1` | Frontend API base URL |
| `COMFYUI_MODELS_DIR` | `./volumes/models` | Host path for model weights |
| `COMFYUI_OUTPUT_DIR` | `./volumes/output` | Shared output directory |
