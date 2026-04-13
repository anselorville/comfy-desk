# CONVENTIONS.md — Code Style & Patterns

## Python (Gateway & Training)

### Style
- **Python 3.12+** syntax — uses `str | None`, `dict[str, Any]`, and modern union types throughout
- No explicit formatter config (no `.ruff.toml`, `pyproject.toml` `[tool.ruff]`, `black.toml`)
- Type annotations on all function signatures in gateway code
- Docstrings present on most public functions and classes

### Async Pattern
All gateway code is **async-first**:
```python
async def _run_generation(task_id: str, request: GenerateRequest):
    ...
    await comfy_client.queue_prompt(wf, client_id)
    images = await comfy_client.wait_for_completion(prompt_id, client_id)
```
- `httpx.AsyncClient` used for all HTTP calls (created per-request, not shared)
- `websockets.connect()` used as async context manager for WebSocket connections
- `asyncio.wait_for()` used for WebSocket timeout enforcement

### Separation of Concerns
Strictly followed in `gateway/`:
- `api/` — thin route handlers: validate input, call service, return response
- `services/` — all business logic: external client calls, data manipulation
- `config.py` — settings only, no logic

Example of thin handler pattern (`gateway/api/generate.py`):
```python
@router.post("/generate")
async def generate(request: GenerateRequest, background_tasks: BackgroundTasks):
    task = create_task(**request.model_dump())
    background_tasks.add_task(_run_generation, task.id, request)
    return {"task_id": task.id, "status": "pending"}
```

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
Training scripts use `argparse` consistently:
- All CLI arguments documented with `help=` strings
- `argparse.Namespace` passed around as `args`
- Comprehensive `--prompt`, `--prompts-file`, `--limit`, `--output-dir` patterns

---

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

Example pattern from `NavBar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
// ...
export default function NavBar() {
  const pathname = usePathname();
  return <nav style={{ background: "rgba(17,17,24,0.85)", ... }}>
  // ...
```

### API Layer (`frontend/src/lib/api.ts`)
- Pure async functions, no framework-specific data fetching (no SWR, React Query, etc.)
- Explicit `fetch()` calls with error propagation via `throw new Error(await res.text())`
- Polling helper `waitForTask()` uses `setInterval` wrapped in a `Promise`
- Interval: 1500ms polling cycle

### State Management
- Local `useState` per page, no shared global state
- Task polling results stored in local component state

### Theming (Design System)
CSS variables in `frontend/src/app/globals.css`:
```css
:root {
  --bg-base: #0a0a0f;         /* Darkest background */
  --bg-surface: #111118;       /* Page surface */
  --bg-card: #16161f;          /* Card background */
  --border: #2a2a3a;           /* Border color */
  --accent: #7c3aed;           /* Primary purple */
  --accent-light: #a855f7;     /* Lighter purple (hover/active) */
  --accent-glow: rgba(124,58,237,0.35);
  --text-primary: #f1f1f6;
  --text-muted: #8888aa;
  --success: #22c55e;
  --error: #ef4444;
  --warning: #f59e0b;
}
```

---

## Workflow Sentinel Convention

ComfyUI workflow templates use `__UPPER_SNAKE_CASE__` string sentinels for parameterizable values:

```json
"inputs": {
  "text": "__POSITIVE_PROMPT__",
  "seed": "__SEED__",
  "width": "__WIDTH__"
}
```

Injection function in `gateway/services/workflow_loader.py`:
```python
elif isinstance(obj, str) and obj.startswith("__") and obj.endswith("__"):
    key = obj[2:-2].lower()
    if key in params:
        return params[key]
```

This same pattern is **duplicated** in `scripts/generate_z_image_batch.py` — a known code smell.

---

## Docker Conventions

- All service names: lowercase (`nginx`, `gateway`, `comfyui`, `joycaption`, `frontend`)
- Container names prefixed: `comfydesk_<service>`
- `env_file: .env` only on `gateway` service (others use explicit `environment:` keys)
- Volumes use host-bound bind mounts (`type: none`, `o: bind`) for easy file access

---

## Git Conventions

- Conventional commit messages (mix of English and Chinese in history)
- `.gitignore` excludes: `.venv/`, `node_modules/`, `volumes/`, `__pycache__/`, `*.safetensors`, `*.ckpt`, `.env`
- Project has only 2 commits in history so far — early stage

---

## Language Mix (UI)

The frontend and docs use **Chinese** for UI labels and in-page text:
- NavBar: `生成` (Generate), `画廊` (Gallery), `标注` (Caption)
- GET-STARTED.md guide is fully in Chinese
- English used for: code, API endpoints, configuration keys, AGENT.md
