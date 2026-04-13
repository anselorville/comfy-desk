# Requirements: ComfyDesk

**Defined:** 2026-04-13
**Core Value:** A single clean UI that lets you generate images and train models on your local GPU — without touching the command line.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Generation (Text-to-Image)

- [ ] **GEN-01**: User can view a list of available generation workflows
- [ ] **GEN-02**: User can select a workflow and see its specific parameters auto-rendered in a form
- [ ] **GEN-03**: User can execute a workflow and see real-time progress/status (not just delayed polling)
- [ ] **GEN-04**: User can view the generated images in a high-quality lightbox/viewer
- [ ] **GEN-05**: User can invoke a prompt enhancement provider (local or external) before generation

### Training (Model Finetuning)

- [ ] **TRAIN-01**: User can browse the images in the dataset directory via a paginated grid
- [ ] **TRAIN-02**: User can select dataset images and auto-generate captions using JoyCaption
- [ ] **TRAIN-03**: User can view and manually edit the `.txt` captions for dataset images
- [ ] **TRAIN-04**: User can configure kohya_ss training parameters via a UI form
- [ ] **TRAIN-05**: User can launch a training job and view the real-time log stream
- [ ] **TRAIN-06**: User can view completed training output models (`.safetensors`)

### Infrastructure & State

- [ ] **SYS-01**: Gateway maintains an active system mode (idle/generation/training)
- [ ] **SYS-02**: Gateway prevents starting generation while training is active, and vice versa
- [ ] **SYS-03**: Frontend disables/locks the inactive module based on system mode
- [ ] **SYS-04**: Tasks are persisted across gateway restarts (e.g., using SQLite)
- [ ] **SYS-05**: Frontend indicates ComfyUI service health status (online/offline)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extensions

- **EXT-01**: User can configure remote GPU endpoints
- **EXT-02**: User can install ComfyUI custom nodes from the UI
- **EXT-03**: Support for video generation workflows

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual node editor | Workflows are authored in ComfyUI native web UI; Desk is for execution. |
| Multi-user auth | Designed for local home-lab; single-operator paradigm. |
| Auto-download huggingface models | User manages model files manually in volume mounts for v1. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEN-01 | Phase 2 | Pending |
| GEN-02 | Phase 2 | Pending |
| GEN-03 | Phase 2 | Pending |
| GEN-04 | Phase 2 | Pending |
| GEN-05 | Phase 2 | Pending |
| TRAIN-01 | Phase 3 | Pending |
| TRAIN-02 | Phase 3 | Pending |
| TRAIN-03 | Phase 3 | Pending |
| TRAIN-04 | Phase 3 | Pending |
| TRAIN-05 | Phase 3 | Pending |
| TRAIN-06 | Phase 3 | Pending |
| SYS-01 | Phase 1 | Pending |
| SYS-02 | Phase 1 | Pending |
| SYS-03 | Phase 1 | Pending |
| SYS-04 | Phase 1 | Pending |
| SYS-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after initial definition*
