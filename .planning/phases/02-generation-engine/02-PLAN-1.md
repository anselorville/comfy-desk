---
wave: 1
depends_on: []
files_modified:
  - gateway/services/workflow_loader.py
  - gateway/api/workflows.py
  - frontend/src/app/page.tsx
  - gateway/api/tasks.py
  - frontend/src/app/api/gallery/route.ts
autonomous: true
---

# Plan 1: Generation Engine & Real-Time Setup

## Goal
Build the core text-to-image loop with workflow config UI, real-time progress, prompt enhancement, and gallery.

## Context
- The workflows need a frontend to be fully interactive instead of static.
- Generation needs progress bars via SSE.
- The gallery needs a polished viewer to avoid direct file-system lag directly in UI mapping logic without pagination.

## Tasks

```xml
<task>
  <description>Create dynamic workflow metadata adapters.</description>
  <read_first>
    - gateway/services/workflow_loader.py
    - gateway/api/workflows.py
  </read_first>
  <action>
    For each JSON in `gateway/workflows/`, define a schema system. Create `.meta.json` files beside `txt2img_sdxl.json`, `txt2img_flux.json`, and `image_z_image_turbo.json` that define fields (like `prompt`, `width`, `height`, `seed`) and defaults.
    Update `gateway/api/workflows.py` to parse and return these `.meta.json` alongside workflow IDs when the frontend requests them.
  </action>
  <acceptance_criteria>
    - `gateway/workflows/txt2img_sdxl.meta.json` exists and contains valid JSON defining parameters.
    - `curl http://localhost:8000/api/v1/workflows` (or corresponding test) returns the metadata.
  </acceptance_criteria>
</task>

<task>
  <description>Implement dynamic forms in the frontend generation UI.</description>
  <read_first>
    - frontend/src/app/page.tsx
    - frontend/src/lib/api.ts
  </read_first>
  <action>
    Modify `frontend/src/app/page.tsx` to fetch the available workflows and their metadata on mount.
    Render a dropdown to select the workflow.
    Based on the selected workflow's `.meta.json` response, dynamically render form inputs (text for `prompt`, number for `width`, etc.) using TailwindCSS styling.
    Pass these gathered parameters into `api.generate(...)`.
  </action>
  <acceptance_criteria>
    - `frontend/src/app/page.tsx` contains a map loop rendering form fields dynamically based on workflow parameters.
    - Changing workflow selection updates the form fields.
  </acceptance_criteria>
</task>

<task>
  <description>Add real-time SSE progress to tasks.</description>
  <read_first>
    - gateway/api/tasks.py
    - gateway/services/comfy_client.py
    - frontend/src/lib/api.ts
  </read_first>
  <action>
    In `gateway/api/tasks.py`, add a new router endpoint `GET /api/v1/tasks/{task_id}/stream`.
    Use FastAPI's `EventSourceResponse` (requires `sse_starlette` dependency) to tap into the running `Task` progress.
    In `gateway/services/comfy_client.py`, when receiving `executing` and `progress` WebSocket events from ComfyUI, update the `Task` object progress property.
    In `frontend/src/lib/api.ts`, replace the manual polling loop `waitForTask` with a standard Javascript `EventSource` listening to `/api/v1/tasks/${id}/stream`, updating React state when events arrive.
  </action>
  <acceptance_criteria>
    - `gateway/api/tasks.py` contains `router.get("/{task_id}/stream")`
    - `frontend/src/lib/api.ts` uses `new EventSource()`
  </acceptance_criteria>
</task>

<task>
  <description>Integrate high-quality lightbox into frontend gallery.</description>
  <read_first>
    - frontend/src/app/gallery/page.tsx
  </read_first>
  <action>
    Add `yet-another-react-lightbox` to frontend dependencies.
    Update `frontend/src/app/gallery/page.tsx` to render thumbnails cleanly with a masonry style or responsive CSS grid using Tailwind `grid-cols-2 md:grid-cols-4`.
    Clicking an image should launch the Lightbox overlay component.
  </action>
  <acceptance_criteria>
    - `frontend/package.json` contains `yet-another-react-lightbox`
    - `frontend/src/app/gallery/page.tsx` imports and uses `Lightbox` component.
  </acceptance_criteria>
</task>
```

## Verification

**must_haves:**
- Workflows are dynamically rendered.
- Progress bar updates smoothly via SSE during generation.
- Gallery supports lightbox viewing without breaking layout.
