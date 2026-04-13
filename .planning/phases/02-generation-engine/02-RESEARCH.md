# Phase 2: Generation Engine - Research

## Overview
Phase 2 focuses on upgrading the existing ComfyUI text-to-image loop from a hardcoded, blind execution engine into a dynamic, realtime product UI.

## Technical Decisions
1. **Workflow Adapter Metadata/Sidecars**: For every `.json` workflow in `gateway/workflows`, we create a `.meta.json` sidecar describing exactly what sentinels exist, their data types, defaults, and human-readable names.
2. **Realtime WebSocket / SSE**: ComfyUI already emits `executed` and `executing` events. The Gateway will relay these to the NextJS frontend via Server-Sent Events (SSE) so the UI can show a progress bar per task.
3. **Prompt Enhancement (Qwen3-4B)**: The text encoder is an offline weights file (`.safetensors`). To use it for enhancement, we need an inference endpoint. Using a lightweight API (like standard vLLM or llama.cpp) pointing to those weights allows the Gateway to route raw prompts through it to generate expanded/stylized prompts before workflow execution.
4. **Lightbox Gallery**: React components like `react-photo-view` or `yet-another-react-lightbox` are mature and fit the requirements perfectly for viewing the grid of outputs.

## Validation Strategy
- Start FastAPI server.
- Request `/api/v1/workflows` and verify metadata is returned alongside paths.
- Subscribe to SSE on `/api/v1/tasks/{task_id}/stream`.
- Start a generation and ensure progress events fire and are correctly formatted.
- Text prompt enhancement toggle invokes Qwen API and substitutes the prompt successfully.
