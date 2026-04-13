# Roadmap: ComfyDesk

**Status:** Active  
**Total Phases:** 3

## Overview

| # | Phase | Goal | Requirements | Criteria |
|---|-------|------|--------------|----------|
| 1 | Infrastructure & State | Establish GPU mode lock, persistent backend tasks (SQLite), and UI layout to prevent resource conflicts. | SYS-01, SYS-02, SYS-03, SYS-04, SYS-05 | 3 |
| 2 | Generation Engine | Build the core text-to-image loop with workflow config UI, real-time progress, prompt enhancement, and gallery. | GEN-01, GEN-02, GEN-03, GEN-04, GEN-05 | 5 |
| 3 | Training Pipeline | Implement full end-to-end dataset captioning and kohya_ss training workbench within the UI. | TRAIN-01, TRAIN-02, TRAIN-03, TRAIN-04, TRAIN-05, TRAIN-06 | 4 |

## Phase Details

### Phase 1: Infrastructure & State
**Goal:** Establish GPU mode lock, persistent backend tasks (SQLite), and UI layout to prevent resource conflicts.
**Requirements mapped:** SYS-01, SYS-02, SYS-03, SYS-04, SYS-05
**UI hint:** yes
**Success criteria:**
1. Global system mode can be toggled via API and persists in the backend.
2. Generating a task when mode is "training" returns an error (and vice versa).
3. Restarting the Gateway does not lose historical tasks.

### Phase 2: Generation Engine
**Goal:** Build the core text-to-image loop with workflow config UI, real-time progress, prompt enhancement, and gallery.
**Requirements mapped:** GEN-01, GEN-02, GEN-03, GEN-04, GEN-05
**UI hint:** yes
**Success criteria:**
1. User can choose `sdxl`, `flux`, or `z-image-turbo` and adjust its specific parameters.
2. Prompt enhancement successfully rewrites the prompt via Qwen3-4B API.
3. Generation shows real-time progress updates rather than blind polling.
4. Generated images open in a high-quality lightbox component.
5. Gallery efficiently displays images without expensive filesystem blocking.

### Phase 3: Training Pipeline
**Goal:** Implement full end-to-end dataset captioning and kohya_ss training workbench within the UI.
**Requirements mapped:** TRAIN-01, TRAIN-02, TRAIN-03, TRAIN-04, TRAIN-05, TRAIN-06
**UI hint:** yes
**Success criteria:**
1. Dataset directory can be navigated with paginated image previews.
2. JoyCaption auto-captioning generates matching `.txt` files for all selected images.
3. LoRA training form successfully starts a decoupled kohya_ss subprocess and captures logs.
4. Output model files are visible and movable into the ComfyUI folder via the UI.

---
*Roadmap created: 2026-04-13*
