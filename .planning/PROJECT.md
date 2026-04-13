# ComfyDesk

## What This Is

ComfyDesk is a product-layer web application that wraps ComfyUI and a training backend into a unified, clean UI. It gives creators a purpose-built workstation for two workflows: **text-to-image generation** (via ComfyUI workflows) and **LoRA/finetune model training** (dataset management + kohya_ss/ai-toolkit). ComfyUI and training tools remain the engines; ComfyDesk is the product interface that orchestrates them.

## Core Value

**A single clean UI that lets you generate images and train models on your local GPU — without touching the command line.**

## Requirements

### Validated

<!-- Already exists in the codebase — confirmed working -->

- ✓ Text-to-image generation via ComfyUI workflow submission (HTTP + WebSocket polling) — existing
- ✓ Multi-workflow support with sentinel-based parameter injection (SDXL, Flux, Z-Image-Turbo) — existing
- ✓ Task system: async job creation, status polling, done/failed states — existing
- ✓ Image gallery: browse generated output images — existing
- ✓ Image captioning via JoyCaption/vLLM (OpenAI-compatible API) — existing
- ✓ Workflow enumeration API (`GET /api/v1/workflows`) — existing
- ✓ Docker Compose full-stack deployment: Nginx + Next.js + FastAPI + ComfyUI + JoyCaption — existing
- ✓ Shared GPU volume mounts for models and output — existing
- ✓ Batch generation script (`generate_z_image_batch.py`) — existing (CLI only, not in UI)

### Active

<!-- New capabilities to build in this milestone -->

**Text-to-Image Module**
- [ ] Workflow selector UI: list all available workflows, select before generating
- [ ] Per-workflow parameter form: auto-render parameters from workflow metadata (prompt, steps, cfg, seed, dimensions, etc.)
- [ ] Text prompt enhancement: send prompt through local Qwen3-4B text encoder or external provider before generation
- [ ] Real-time generation progress: live status updates (not just polling), WebSocket or SSE feed
- [ ] Premium image viewer: lightbox, zoom, side-by-side comparison, grid/single toggle
- [ ] Image management: download, delete, tag/group generated images

**Model Training Module**
- [ ] Dataset workbench: browse dataset folder, preview images in grid, paginated
- [ ] Auto-caption pipeline: select images → call JoyCaption → save `.txt` captions alongside images
- [ ] Caption editor: view and manually edit captions per image
- [ ] Training job launcher: form-based configuration of kohya_ss/ai-toolkit training params (base model, network_dim, lr, epochs, resolution, batch size)
- [ ] Training job monitor: real-time log streaming from training process, progress indicator
- [ ] Training output management: list produced `.safetensors` files, push to ComfyUI models directory

**Text Enhancement / Provider Module**
- [ ] Local provider: route prompt through Qwen3-4B (already in `comfy-ui/models/text_encoders/`) via inference endpoint
- [ ] External provider connector: configure API key + endpoint for OpenAI-compatible providers (OpenAI, Anthropic, DeepSeek, etc.)
- [ ] Provider selector: per-session choice of local vs external for prompt enhancement

**System / Infrastructure**
- [ ] GPU mode lock: backend `GET/POST /api/v1/system/mode` endpoint returning active module (idle / generating / training); frontend soft-locks inactive module
- [ ] ComfyUI service health indicator: live status in nav (online / offline / busy)
- [ ] Workflow adapter metadata: JSON sidecar per workflow describing parameter names, types, defaults, labels for UI rendering
- [ ] Migrate training scripts to be gateway-invocable (subprocess + log streaming via SSE)

### Out of Scope

- Visual ComfyUI workflow editor inside Desk — workflows are developed in ComfyUI's native WebUI, Desk only executes them
- Real-time collaborative usage (multi-user) — single-operator local workstation design
- Cloud inference / remote GPU offload — local GPU only for v1
- Mobile app — web-first, deployed on local network or self-hosted server
- OAuth / multi-user auth — local home-lab deployment, optional API key gate only
- Video generation — image-only for v1
- Automatic model downloading from HuggingFace in UI — models placed manually in volume mounts

## Context

**Existing codebase state (brownfield):**
- Next.js 16 App Router frontend with TailwindCSS 4 (currently underutilized — inline styles dominate)
- FastAPI gateway with ComfyUI client, JoyCaption client, task store (in-memory), workflow loader
- 3 ComfyUI workflows: `txt2img_sdxl.json`, `txt2img_flux.json`, `image_z_image_turbo.json`
- Training scripts exist (`training/`) but are fully CLI-only, not gateway-integrated
- Only 2 git commits — effectively at the architectural scaffold stage
- Known issues: no auth enforcement, in-memory task store (no persistence), CORS open, no tests, duplicate sentinel logic

**GPU constraint (critical):**
- Single NVIDIA GPU (24GB VRAM target; 12GB minimum)
- ComfyUI (inference) and training (kohya_ss/ai-toolkit) cannot run simultaneously
- JoyCaption captioning uses ~45% GPU and can be active during training dataset prep (low inference load) but must yield during active generation
- System mode lock enforces mutual exclusion at the application layer

**Qwen3-4B text encoder:**
- Already present at `comfy-ui/models/text_encoders/qwen_3_4b.safetensors`
- Can serve dual purpose: (1) ComfyUI internal text encoding for Flux workflows, (2) prompt enhancement API for Desk frontend
- Requires a local inference endpoint (vLLM or llama.cpp) to be accessible as an API from the gateway

**Design philosophy:**
- ComfyUI = execution engine (not the product)
- kohya_ss / ai-toolkit = training engine (not the product)
- ComfyDesk = the product layer — clean, fresh, minimal aesthetic
- Deployment target: CUDA-capable local server, potentially centralized with lightweight front-facing layer later

## Constraints

- **Tech Stack**: Next.js + FastAPI + Docker Compose — extend existing stack, do not replace
- **GPU**: Single GPU, mutual exclusion required between generation and training workloads
- **Styling**: Fresh, minimal, clean aesthetic (不是暗黑heavy风格) — redesign current dark purple theme
- **Image viewing**: Must use a mature, polished image viewing solution (lightbox-quality)
- **Deployment**: Lightweight — avoid adding heavy infrastructure dependencies; no Redis or Postgres for v1 (enhance in-memory or use SQLite)
- **ComfyUI dependency**: ComfyUI must be running for generation; Desk does not manage ComfyUI's lifecycle in v1 (startup is manual or via Docker Compose)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ComfyUI for inference only; kohya_ss/ai-toolkit for training (separate toolchains) | ComfyUI training nodes are immature; kohya_ss is the gold standard | — Pending |
| Frontend soft-lock + backend mode state for GPU mutual exclusion | Simpler than process management; sufficient for single-operator use | — Pending |
| Workflow adapter metadata as JSON sidecar files | Allows UI to auto-render parameter forms without hardcoding per workflow | — Pending |
| Qwen3-4B as local prompt enhancer via separate vLLM endpoint (or llama.cpp) | Already in model directory; avoid duplicating text encoder setup | — Pending |
| SQLite for task persistence (replace in-memory dict) | Lightweight, no extra infrastructure, survives gateway restarts | — Pending |
| Keep TailwindCSS 4 but actually use utility classes (fix inline style inconsistency) | Framework already installed; consistent design system needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after initialization*
