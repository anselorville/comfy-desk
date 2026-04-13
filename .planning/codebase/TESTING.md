# TESTING.md — Test Structure & Practices

## Project-Level Tests

### Gateway
**No tests exist** for the custom gateway code (`gateway/`). The gateway has:
- No `tests/` directory
- No `pytest.ini` or test config
- No conftest.py
- Zero test files

This is a significant gap for the core business logic layer.

### Frontend
**No tests exist** for the Next.js frontend (`frontend/src/`). No Jest, Vitest, or Playwright setup found.

### Training Scripts
**No tests exist** for `training/` scripts.

### Scripts
**No tests exist** for `scripts/` utility scripts.

---

## ComfyUI Tests (Bundled Submodule)

The `comfy-ui/` directory contains ComfyUI's own test suite. These are **not project tests** — they belong to the upstream ComfyUI codebase:

```
comfy-ui/
├── pytest.ini              ← ComfyUI test configuration
├── tests/                  ← ComfyUI integration tests
└── tests-unit/             ← ComfyUI unit tests
```

ComfyUI's `pytest.ini` exists at `comfy-ui/pytest.ini`. These tests cover ComfyUI's internal node execution, sampling, and API — not the ComfyDesk gateway or frontend.

---

## Test Frameworks (Available, Not Yet Used)

Based on `pyproject.toml` dependencies, the following are available in `.venv`:
- **pytest** — available (installed as transitive dep via ComfyUI)
- No FastAPI TestClient usage anywhere

For the frontend, **no test framework** is installed:
- No `jest`, `vitest`, or `@playwright/test` in `package.json`
- No test scripts in `package.json`

---

## How to Test (Current State)

### Manual Testing
The only verification documented is manual via Swagger UI and curl:
```bash
# Health check
curl http://localhost:8001/api/health

# Generate image
curl -X POST http://localhost/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "workflow": "txt2img_sdxl"}'

# Check Swagger UI
open http://localhost:8001/api/docs
```

### Training Validation
`training/verify_dataset.py` provides dataset integrity checking (file existence, format, corruption detection) — this is functional/data validation, not unit testing.

---

## Testing Gaps Summary

| Component | Status | Priority |
|-----------|--------|----------|
| `gateway/services/workflow_loader.py` | ❌ No tests | High — pure logic, easy to unit test |
| `gateway/services/task_store.py` | ❌ No tests | Medium — simple in-memory store |
| `gateway/services/comfy_client.py` | ❌ No tests | Medium — needs mock ComfyUI |
| `gateway/services/caption_client.py` | ❌ No tests | Medium — needs mock vLLM |
| `gateway/api/*` | ❌ No tests | High — FastAPI TestClient ready |
| `frontend/src/lib/api.ts` | ❌ No tests | Medium — fetch mocking |
| `frontend/` pages | ❌ No tests | Low — UI tests |
| `training/*.py` | ❌ No tests | Low — script validation |
| `scripts/*.py` | ❌ No tests | Low — standalone utilities |

---

## Recommended Test Setup (Not Yet Implemented)

### Gateway
```
gateway/
└── tests/
    ├── conftest.py          ← FastAPI TestClient fixture
    ├── test_generate.py     ← POST /generate, task lifecycle
    ├── test_caption.py      ← POST /caption validation
    ├── test_workflows.py    ← GET /workflows listing
    └── services/
        ├── test_workflow_loader.py  ← Sentinel injection logic
        └── test_task_store.py       ← Task CRUD
```

### Frontend
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

### CI
No CI/CD pipeline exists for `comfy-desk` itself (only `comfy-ui/` has `.github/` and `.ci/` — these belong to ComfyUI upstream).
