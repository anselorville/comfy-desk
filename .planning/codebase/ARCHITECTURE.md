# ARCHITECTURE.md — System Architecture

## Architectural Pattern

**Microservices with API Gateway** — four distinct services communicating over a Docker bridge network, unified behind a single Nginx reverse proxy.

```
Browser / Mobile Client
         │
    Nginx :80 (reverse proxy)
    ├── /api/*     → FastAPI Gateway :8000
    ├── /images/*  → Static file serving (comfyui output volume)
    └── /*         → Next.js Frontend :3000
              │
       FastAPI Gateway
       ├── /api/v1/generate    → ComfyUI (HTTP + WebSocket)
       ├── /api/v1/tasks/{id}  → In-memory task store
       ├── /api/v1/caption     → JoyCaption/vLLM (HTTP)
       └── /api/v1/workflows   → Local JSON files
              │
    ┌─────────┴──────────┐
ComfyUI :8188        JoyCaption/vLLM :8000
(ai-dock image)      (vllm-openai image)
    │                        │
GPU (NVIDIA)           GPU (NVIDIA, 0.45 frac)
```

## Data Flow — Image Generation

```
1. User POSTs to /api/v1/generate
2. Gateway creates Task (UUID) → returns task_id immediately
3. BackgroundTask spawns _run_generation() coroutine
4. Gateway loads workflow JSON from gateway/workflows/<name>.json
5. Injects parameters (prompt, steps, cfg, etc.) via sentinel replacement
6. POSTs workflow to ComfyUI /prompt with unique client_id
7. Opens WebSocket to ComfyUI /ws?clientId={client_id}
8. Listens for type=executed → collects output image filenames
9. Updates Task status: pending → running → done/failed
10. User polls GET /api/v1/tasks/{task_id} until status=done
11. Frontend displays images via /images/<filename> (Nginx-served)
```

## Data Flow — Image Captioning

```
1. User uploads image to POST /api/v1/caption (multipart)
2. Gateway validates: content-type (jpeg/png/webp), size (≤50MB)
3. Encodes image as base64 JPEG data URL
4. POSTs to JoyCaption vLLM /v1/chat/completions
5. Returns caption string synchronously (up to 120s timeout)
```

## Data Flow — Gallery

```
1. Next.js route handler GET /api/gallery reads OUTPUT_DIR filesystem
2. Returns sorted list of image files (newest first)
3. Frontend renders images with src=/images/<filename>
4. Nginx serves /images/* directly from mounted output volume
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

**Next.js App Router** with 3 routes + 1 API route:

```
src/app/
├── layout.tsx        — Root layout with NavBar + Inter font
├── globals.css       — CSS variables (dark theme, purple accent)
├── page.tsx          — Text-to-image generator (main page)
├── gallery/
│   └── page.tsx      — Image gallery browser
├── caption/
│   └── page.tsx      — JoyCaption annotation tool
└── api/
    └── gallery/
        └── route.ts  — Next.js route handler: reads output directory
src/components/
└── NavBar.tsx        — Sticky nav: 生成 | 画廊 | 标注
src/lib/
└── api.ts            — All gateway API calls + polling helper
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
