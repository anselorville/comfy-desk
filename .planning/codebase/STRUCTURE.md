# STRUCTURE.md — Directory Layout & Organization

## Repository Root

```
comfy-desk/
├── AGENT.md                    ← AI agent coding guidelines
├── GET-STARTED.md              ← Local dev setup guide (Chinese)
├── README.md                   ← Project overview and quick start
├── docker-compose.yml          ← All 5 services (nginx, frontend, gateway, comfyui, joycaption)
├── .env.example                ← Template for environment variables
├── pyproject.toml              ← Python project deps (uv, root gateway + training)
├── uv.lock                     ← Locked Python dependency tree
├── .python-version             ← Python 3.12
├── .gitignore                  ← Excludes .venv/, node_modules/, volumes/, etc.
├── .venv/                      ← Python virtual environment (git-ignored)
├── .vscode/                    ← Editor settings
├── .codex/                     ← Codex agent config
├── .draft/                     ← Draft/notes files (Chinese planning docs)
├── gateway/                    ← FastAPI API gateway (Python)
├── frontend/                   ← Next.js frontend (TypeScript)
├── nginx/                      ← Nginx reverse proxy config
├── training/                   ← Dataset preparation + LoRA training scripts
├── scripts/                    ← Standalone utility scripts
├── startup/                    ← Convenience startup scripts
├── comfy-ui/                   ← ComfyUI submodule/copy (Python, large)
├── outputs/                    ← (runtime output directory, git-ignored)
└── .planning/                  ← GSD planning artifacts
```

---

## `gateway/` — FastAPI API Gateway

```
gateway/
├── Dockerfile                  ← Container definition
├── requirements.txt            ← Pinned gateway dependencies
├── main.py                     ← FastAPI app factory, router registration, CORS
├── config.py                   ← Settings (BaseSettings, reads .env)
├── api/                        ← Route handlers (thin: delegate to services/)
│   ├── generate.py             ← POST /api/v1/generate
│   ├── tasks.py                ← GET /api/v1/tasks/{task_id}
│   ├── caption.py              ← POST /api/v1/caption
│   └── workflows.py            ← GET /api/v1/workflows[/{name}]
├── services/                   ← Business logic + external clients
│   ├── comfy_client.py         ← ComfyUI HTTP + WebSocket client
│   ├── caption_client.py       ← JoyCaption vLLM client + CAPTION_PROMPTS
│   ├── task_store.py           ← In-memory Task dataclass store
│   └── workflow_loader.py      ← JSON workflow loader + sentinel injection
└── workflows/                  ← ComfyUI API-format workflow JSON templates
    ├── txt2img_sdxl.json
    ├── txt2img_flux.json
    └── image_z_image_turbo.json
```

**Naming**: files named by domain (`caption.py`, `generate.py`), not by pattern.

---

## `frontend/` — Next.js Frontend

```
frontend/
├── Dockerfile                  ← Container definition (standalone build)
├── package.json                ← Node deps (Next.js 16, React 19, Tailwind 4)
├── package-lock.json           ← Locked npm deps
├── next.config.ts              ← Next.js config (standalone output, open image domains)
├── next-env.d.ts               ← TypeScript env types
├── eslint.config.mjs           ← ESLint (next/core-web-vitals + TypeScript)
├── postcss.config.mjs          ← PostCSS config for Tailwind
├── public/                     ← Static assets
│   ├── file.svg
│   ├── globe.svg
│   └── next.svg
└── src/
    ├── app/                    ← Next.js App Router pages
    │   ├── layout.tsx          ← Root layout (NavBar + Inter font + metadata)
    │   ├── globals.css         ← Global CSS + design tokens
    │   ├── page.tsx            ← / — Text-to-image generator (main UI)
    │   ├── gallery/
    │   │   └── page.tsx        ← /gallery — Image gallery browser
    │   ├── caption/
    │   │   └── page.tsx        ← /caption — JoyCaption annotation tool
    │   └── api/
    │       └── gallery/
    │           └── route.ts    ← GET /api/gallery — reads output dir
    ├── components/
    │   └── NavBar.tsx          ← Sticky navigation bar
    └── lib/
        └── api.ts              ← All API interaction functions + types
```

**Key locations**:
- API types: `frontend/src/lib/api.ts` (interfaces `GenerateRequest`, `TaskResponse`, `CaptionResponse`)
- Design tokens: `frontend/src/app/globals.css` (CSS custom properties)
- Gallery filesystem read: `frontend/src/app/api/gallery/route.ts`

---

## `training/` — Dataset & LoRA Scripts

```
training/
├── requirements.txt            ← Training-only deps (httpx, pillow, tqdm, aiofiles)
├── launch_lora.sh              ← LoRA training launcher (calls kohya_ss)
├── resize_images.py            ← Image preprocessing (resize, dedupe, format)
├── prepare_dataset.py          ← Batch caption generation using ComfyDesk API
└── verify_dataset.py           ← Dataset integrity validation
```

**Pipeline order**: `resize_images.py` → `prepare_dataset.py` → `verify_dataset.py` → `launch_lora.sh`

---

## `scripts/` — Standalone Utilities

```
scripts/
├── generate_z_image_batch.py   ← Direct ComfyUI batch prompt runner (bypasses gateway)
└── z_image_prompts.txt         ← Sample prompt list for batch generation
```

Note: `generate_z_image_batch.py` reimplements the sentinel substitution logic independently from `gateway/services/workflow_loader.py`.

---

## `nginx/`

```
nginx/
└── nginx.conf                  ← Routing rules: /api/* → gateway, /images/* → volume, /* → frontend
```

---

## `startup/` — Convenience Scripts

```
startup/
├── start.bat                   ← Windows: start gateway + frontend
├── start-comfyui.bat           ← Windows: start ComfyUI
└── start.sh                    ← Linux/Mac: start gateway + frontend
```

---

## `comfy-ui/` — ComfyUI Source

A large Python monorepo (the actual ComfyUI engine). Key subdirectories:

```
comfy-ui/
├── main.py                     ← ComfyUI entry point
├── server.py                   ← aiohttp server
├── execution.py                ← Workflow execution engine
├── nodes.py                    ← Core node definitions
├── comfy/                      ← Core ML modules (CLIP, diffusion, etc.)
├── comfy_api/                  ← Public API surface v0_0_1/v0_0_2/latest
├── comfy_api_nodes/            ← External API integration nodes (BFL, OpenAI, Gemini, etc.)
├── comfy_execution/            ← Execution engine components
├── comfy_extras/               ← Extra node implementations
├── comfy_config/               ← Config parser
├── api_server/                 ← REST API server
├── app/                        ← App-level utilities
├── custom_nodes/               ← User-installed extensions
├── blueprints/                 ← Pre-built workflow blueprints (many!)
├── middleware/                 ← ComfyUI middleware
├── tests/                      ← Integration tests
├── tests-unit/                 ← Unit tests
├── alembic_db/                 ← DB migrations
├── requirements.txt            ← ComfyUI Python deps
└── pyproject.toml              ← Package definition
```

---

## Naming Conventions

| Scope | Pattern | Example |
|-------|---------|---------|
| Python modules | `snake_case.py` | `caption_client.py`, `task_store.py` |
| Python packages | `snake_case/` + `__init__.py` | `comfy_api/`, `comfy_execution/` |
| TypeScript files | `PascalCase.tsx` for components | `NavBar.tsx` |
| TypeScript files | `camelCase.ts` for utilities | `api.ts` |
| Next.js pages | `page.tsx` (App Router convention) | `gallery/page.tsx` |
| Docker services | `snake_case` | `comfyui`, `joycaption`, `gateway` |
| Env variables | `UPPER_SNAKE_CASE` | `COMFYUI_URL`, `HF_TOKEN` |
| Workflow names | `snake_case` | `txt2img_sdxl`, `image_z_image_turbo` |
| Sentinel values | `__UPPER_SNAKE_CASE__` | `__POSITIVE_PROMPT__`, `__WIDTH__` |
