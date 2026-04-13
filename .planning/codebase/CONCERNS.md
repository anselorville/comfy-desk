# CONCERNS.md — Technical Debt, Issues & Fragile Areas

## 🔴 Critical

### 1. No Authentication Enforcement
**Location**: `gateway/config.py`, `gateway/main.py`
- `gateway_api_key` config field exists but is **never checked** in any route handler
- Comment in `main.py`: `allow_origins=["*"],   # tighten in production`
- Anyone with network access to the gateway can generate images, read all tasks, etc.
- **Risk**: High if deployed publicly; acceptable for local home lab

### 2. In-Memory Task Store — No Persistence
**Location**: `gateway/services/task_store.py`
- `_store: dict[str, Task]` — plain Python dict in-process memory
- **All tasks lost on gateway restart or crash**
- Comment acknowledges: "Replace with Redis-backed store for multi-worker scalability"
- No cleanup mechanism — store grows unbounded over time (memory leak vector)

### 3. No Tests on Any Custom Code
**Location**: All of `gateway/`, `frontend/src/`, `training/`, `scripts/`
- Zero unit tests, zero integration tests, zero E2E tests
- Core logic (`workflow_loader.py`, `task_store.py`, sentinel injection) completely uncovered
- Any refactor or new feature has no regression safety net

---

## 🟠 High Priority

### 4. Duplicate Sentinel Injection Logic
**Locations**:
- `gateway/services/workflow_loader.py` — `inject_params()` / `_replace_sentinels()`
- `scripts/generate_z_image_batch.py` — `replace_sentinels()`

Two independent implementations of the same `__SENTINEL__` substitution logic. Changes to sentinel format must be updated in both places.

### 5. httpx.AsyncClient Created Per-Request
**Location**: `gateway/services/comfy_client.py`, `gateway/services/caption_client.py`
- Each function call creates a new `httpx.AsyncClient(...)` and tears it down
- No connection pooling — each generation request opens a new TCP connection to ComfyUI
- For high-frequency requests this wastes connection setup overhead
- Should use a module-level or lifespan-managed shared client

### 6. ComfyUI WebSocket Timeout — Silent Degradation
**Location**: `gateway/services/comfy_client.py` — `wait_for_completion()`
```python
except asyncio.TimeoutError:
    logger.warning("ComfyUI prompt %s timed out after %ss", prompt_id, timeout)
# returns empty list — task marked DONE with no images
```
- Timeout returns empty list, causing task to be marked DONE with `images=[]`
- Frontend gets `status: done` but no images — confusing UX
- Should mark task as FAILED on timeout

### 7. CORS Open to All Origins
**Location**: `gateway/main.py`
```python
allow_origins=["*"],   # tighten in production
```
- Intentional for development but no mechanism to enforce this is restricted in production
- No production vs dev config separation

### 8. No Rate Limiting
**Location**: Gateway, all endpoints
- Unlimited concurrent generation requests are accepted
- ComfyUI queues them, but gateway creates a task for each with no throttling
- Memory will grow unbounded if many tasks are submitted

---

## 🟡 Medium Priority

### 9. Gallery Route Reads Filesystem Directly
**Location**: `frontend/src/app/api/gallery/route.ts`
- Next.js API route reads `OUTPUT_DIR` with `readdir()` at request time
- No caching — every gallery page load hits the filesystem
- Falls back to `{ images: [] }` on any error (silently swallows filesystem errors)
- Image list is not sorted by modification time — uses `reverse()` on filename list which only works if filenames are chronologically ordered

### 10. Training Scripts Call Gateway API
**Location**: `training/prepare_dataset.py`
- Dataset caption generation script calls the ComfyDesk gateway API
- Tight coupling between training pipeline and gateway availability
- If gateway is down, training dataset prep fails

### 11. vLLM/JoyCaption Startup Dependency Not Handled
**Location**: `gateway/services/caption_client.py`
- No health check or retry on JoyCaption startup
- `docker-compose.yml` has no `healthcheck:` on `joycaption` service
- Gateway depends on `comfyui` and `joycaption` in compose but only at container start, not readiness
- Caption requests will fail silently if JoyCaption is still loading the model (can take several minutes)

### 12. Image Download Is Indirect
**Location**: `gateway/api/tasks.py`
- Task response returns `/images/<filename>` URLs relative to nginx
- In local dev (no nginx), these URLs point to `localhost/images/...` which doesn't resolve
- Dev setup requires either nginx or knowing to access images directly from ComfyUI's `/view` endpoint

### 13. Frontend Uses Inline Styles (Not Tailwind Classes)
**Location**: All of `frontend/src/app/*.tsx`, `frontend/src/components/NavBar.tsx`
- Tailwind 4 is installed and imported but JSX components use `style={{...}}` inline objects
- Design system CSS variables exist in `globals.css` but used via inline styles, not Tailwind utilities
- Inconsistent: a full styling library is installed but barely used in JSX

---

## 🟢 Low Priority / Notes

### 14. No HF_TOKEN Validation  
**Location**: `docker-compose.yml`, `gateway/config.py`
- `HF_TOKEN` env var is passed through but never validated
- If the joycaption model is gated and HF_TOKEN is missing, vLLM fails silently at startup

### 15. ComfyUI Image Path Inconsistency
**Location**: `gateway/api/tasks.py` vs `nginx/nginx.conf`
- Tasks return `/images/<filename>` (no subfolder)
- Nginx serves `/images/` from `/var/comfydesk/output/`
- ComfyUI saves to `output/comfydesk/` subfolder in some workflows
- This can cause 404s if output subfolder structure doesn't match Nginx alias

### 16. `generate_z_image_batch.py` Not Integrated
**Location**: `scripts/generate_z_image_batch.py`
- Standalone script bypasses the gateway entirely
- Useful for power users but not surfaced in UI or docs beyond GET-STARTED.md
- May diverge from gateway workflow format over time

### 17. Very Early Codebase (2 commits)
**Location**: git log
- Only 2 commits in history — project is at greenfield stage
- Technical debt level is inherently low but test coverage and auth are deferred

### 18. GPU Memory Fragility
**Location**: `docker-compose.yml` comments, `README.md`
- JoyCaption + ComfyUI share 22GB VRAM with tight margins
- README explicitly documents: "If OOM, stop one service"
- No programmatic OOM handling — relies on manual operator intervention
- `shm_size: "8gb"` on JoyCaption — must match host shared memory config
