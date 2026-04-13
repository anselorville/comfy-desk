# Phase 1: Infrastructure & State - Research

## Overview
This phase establishes the foundational infrastructure needed to ensure that ComfyUI (inference) and training routines mutually exclude each other due to the single-GPU memory constraint.

## Key Technical Decisions
- **Database/Persistence**: SQLite using `aiosqlite` for the FastAPI backend async usage (or just standard `sqlite3` depending on ORM). We will replace the in-memory `_store` dict in `gateway/services/task_store.py` with SQLite. 
- **Mode Lock**: The Gateway API needs a state manager (in SQLite or in-memory, SQLite preferred) that persists the system intent: `idle`, `generating`, `training`. Any generation task requests must fail HTTP 409 if in `training`, and vice-versa.
- **Frontend Soft Lock**: The Next.js frontend will poll or use Server Sent Events / WebSockets for system mode and disable interactive items (opacity-50, cursor-not-allowed).
- **Service Health**: Ping `http://comfyui:8188/system_stats` to update UI of ComfyUI's liveliness.

## ORM / Schema
- Python standard library `sqlite3` or `SQLAlchemy` async wrapper. We will use a lightweight standard `aiosqlite` database or simple JSON file if SQLite is overkill. Given the tech stack is `pyproject.toml`, let's just use `aiosqlite`.

## Validation Strategy
- Start ComfyDesk. Check that `/api/v1/system/mode` exists and defaults to `idle`.
- Set mode to `training`. Send a `POST /api/v1/generate`. It must return 409 Conflict.
- Verify that killing the gateway and restarting it retains historical tasks (via SQLite).
