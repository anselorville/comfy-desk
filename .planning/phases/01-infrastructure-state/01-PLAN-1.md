---
wave: 1
depends_on: []
files_modified:
  - gateway/services/task_store.py
  - gateway/api/tasks.py
  - gateway/main.py
  - frontend/src/lib/api.ts
  - frontend/src/components/NavBar.tsx
  - gateway/pyproject.toml
autonomous: true
---

# Plan 1: Infrastructure & State

## Goal
Establish GPU mode lock, persistent backend tasks (SQLite), and UI layout to prevent resource conflicts.

## Context
- The project runs on a single NVIDIA GPU.
- Memory constraints mean generation and training must be mutually exclusive.
- Tasks are currently stored in-memory in the gateway and lost upon restart.

## Tasks

```xml
<task>
  <description>Migrate in-memory task store to SQLite using aiosqlite.</description>
  <read_first>
    - gateway/services/task_store.py
    - gateway/api/tasks.py
    - gateway/main.py
  </read_first>
  <action>
    Modify `gateway/services/task_store.py` to use `aiosqlite`.
    Add `aiosqlite` to `gateway/pyproject.toml` dependencies (by running `uv add aiosqlite`).
    Initialize the database file at `outputs/tasks.sqlite` on gateway startup.
    Create a `tasks` table with columns: `id` (TEXT PRIMARY KEY), `status` (TEXT), `progress` (INTEGER), `images` (TEXT - json string), `error` (TEXT), `params` (TEXT - json string).
    Refactor `_store` dict methods (`add_task`, `update_task`, `get_task`, `list_tasks`) to perform async SQL queries.
  </action>
  <acceptance_criteria>
    - `gateway/pyproject.toml` contains `aiosqlite`
    - `gateway/services/task_store.py` contains `CREATE TABLE IF NOT EXISTS tasks`
    - Tasks survive a gateway restart
  </acceptance_criteria>
</task>

<task>
  <description>Implement System Mode State in Gateway API.</description>
  <read_first>
    - gateway/services/task_store.py
    - gateway/api/tasks.py
    - gateway/api/generate.py
  </read_first>
  <action>
    Create a new file `gateway/api/system.py` exposing `GET /api/v1/system/mode` and `POST /api/v1/system/mode`.
    The mode can be `idle`, `generating`, or `training`.
    Store this active state in the `tasks.sqlite` DB in a new `system_state` table or just a global in-memory variable (since it represents immediate hardware state, it doesn't need to survive restarts, in-memory is fine). Let's use in-memory `SYSTEM_MODE = "idle"`.
    In `gateway/api/generate.py`, if `SYSTEM_MODE` is `training`, return `HTTPException(409, "System is occupied by training")`.
    In `gateway/main.py`, include the new `system.py` router.
  </action>
  <acceptance_criteria>
    - `gateway/api/system.py` contains `router.get("/system/mode")`
    - `gateway/api/generate.py` contains `if SYSTEM_MODE == "training": raise HTTPException(status_code=409)`
  </acceptance_criteria>
</task>

<task>
  <description>Implement System Health and Mode Lock in Frontend UI.</description>
  <read_first>
    - frontend/src/components/NavBar.tsx
    - frontend/src/lib/api.ts
  </read_first>
  <action>
    In `frontend/src/lib/api.ts`, add `fetchSystemMode()` returning `{ mode: string }` and `fetchSystemStats()` returning ComfyUI health.
    In `frontend/src/components/NavBar.tsx`, use React `useEffect` to poll `fetchSystemMode` and `fetchSystemStats` every 2000ms.
    Display a status widget in the NavBar: e.g., "Status: Idle (ComfyUI Online)". Use green text for `idle`/online, amber for `generating`/`training`.
    Apply Tailwind classes `opacity-50 cursor-not-allowed` to the main "Generate" or UI components when the mode is not `idle` and not matching the current screen intent.
  </action>
  <acceptance_criteria>
    - `frontend/src/lib/api.ts` exports `fetchSystemMode`
    - `frontend/src/components/NavBar.tsx` uses setInterval or SWR to fetch system status
    - The NavBar displays visual feedback based on the system state
  </acceptance_criteria>
</task>
```

## Verification

**must_haves:**
- The task history is preserved across server restarts.
- Attempting to generate an image while mode=training returns an HTTP 409 error.
- The UI properly displays the system mode and locks generation functionalities when busy.
