# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** A single clean UI that lets you generate images and train models on your local GPU — without touching the command line.
**Current focus:** Ready to start Phase 1 (Infrastructure & State)

## Current Status

- **Phase:** 0
- **Plan:** Not started
- **Recent activity:** Project initialized.

## Memory

- Project is using a mono-repo structure (FastAPI gateway + Next.js frontend).
- A YOLO configuration is defined with parallel execution allowed.
- The GPU is expected to be shared mutually-exclusively (generation vs training) via a system lock approach.

---
*Last updated: 2026-04-13*
