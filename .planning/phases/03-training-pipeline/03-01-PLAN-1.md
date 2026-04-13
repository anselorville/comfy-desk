---
wave: 1
depends_on: []
files_modified:
  - gateway/api/dataset.py
  - frontend/src/app/training/page.tsx
  - gateway/api/training.py
  - frontend/src/components/TrainingLogs.tsx
autonomous: true
---

# Plan 1: Training Pipeline integration

## Goal
Implement full end-to-end dataset captioning and kohya_ss training workbench within the UI.

## Context
- The user creates datasets locally across directories.
- They need an easy way to view images and edit text documents that define the LoRA learning prompt.
- Training can take hours, meaning we need reliable background execution and live log viewing.

## Tasks

```xml
<task>
  <description>Create dataset viewer endpoints in Gateway.</description>
  <read_first>
    - gateway/api/dataset.py
    - gateway/main.py
  </read_first>
  <action>
    Create `gateway/api/dataset.py`.
    Implement `GET /api/v1/dataset/images` reading from the `DATASET_DIR` environment variable. Return lists of images with metadata regarding whether a `.txt` file exists.
    Implement `GET /api/v1/dataset/images/{id}/caption` returning the text content of the associated `.txt` file.
    Implement `PUT /api/v1/dataset/images/{id}/caption` to overwrite the text file context.
    Include this router in `main.py`.
  </action>
  <acceptance_criteria>
    - `gateway/api/dataset.py` contains `router.get("/images")`
    - `gateway/api/dataset.py` contains `router.put("/images/{id}/caption")`
  </acceptance_criteria>
</task>

<task>
  <description>Build the JoyCaption Batch Automation Endpoint.</description>
  <read_first>
    - gateway/api/dataset.py
    - gateway/services/caption_client.py
  </read_first>
  <action>
    In `gateway/api/dataset.py`, add `POST /api/v1/dataset/caption-batch`.
    It should take a list of image IDs, then asynchronously loop over them, calling `caption_client.py`'s `get_caption(image)` and writing the output to the `.txt` sidecar files in the dataset folder.
    Use existing FastAPI BackgroundTasks to process this so the HTTP request completes immediately.
  </action>
  <acceptance_criteria>
    - `gateway/api/dataset.py` contains `router.post("/caption-batch")` calling a background function.
  </acceptance_criteria>
</task>

<task>
  <description>Create Training Job API with Log Streaming.</description>
  <read_first>
    - gateway/api/training.py
  </read_first>
  <action>
    Create `gateway/api/training.py` with `POST /api/v1/training/start`.
    This endpoint spawns `asyncio.create_subprocess_exec("bash", "training/launch_lora.sh", ...args)`.
    Store the training subprocess output in a rolling buffer or streaming queue.
    Add `GET /api/v1/training/logs` returning an `EventSourceResponse` (SSE) yielding lines from the process stdout/stderr.
  </action>
  <acceptance_criteria>
    - `gateway/api/training.py` contains `asyncio.create_subprocess_exec`
    - `gateway/api/training.py` exports an SSE endpoint `/logs`.
  </acceptance_criteria>
</task>

<task>
  <description>Implement Training UI and Terminal component.</description>
  <read_first>
    - frontend/src/app/training/page.tsx
    - frontend/src/components/TrainingLogs.tsx
    - frontend/src/lib/api.ts
  </read_first>
  <action>
    Create the Training hub UI `frontend/src/app/training/page.tsx`.
    Add a dataset viewer section that fetches images. Select boxes next to images allow batch auto-caption triggering.
    Clicking an image allows editing its caption manually in a modal or side-panel.
    Add a training trigger form with inputs for epoch limit and learning rate.
    Build `frontend/src/components/TrainingLogs.tsx` reading from the SSE event stream, styled as a dark code block (`bg-slate-900 text-green-400 font-mono scrollbar-hide`) simulating a terminal.
  </action>
  <acceptance_criteria>
    - `frontend/src/app/training/page.tsx` exists and renders the interface.
    - `frontend/src/components/TrainingLogs.tsx` utilizes `new EventSource()` and displays streaming lines.
  </acceptance_criteria>
</task>
```

## Verification

**must_haves:**
- All 6 endpoints correctly map their internal states.
- SSE correctly surfaces kohya process logs in the UI without browser lockups.
- Text overrides work seamlessly on the local file system.
