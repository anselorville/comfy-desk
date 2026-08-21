"""
Artifact collection API — the desk shell's platform artifact index.

GET /api/v1/artifacts — recent completed/failed tasks with their outputs
(images, workflow, skill, params, timestamps). This is the single feed the
frontend gallery and external tooling consume to collect everything the
platform has produced.
"""
from fastapi import APIRouter, HTTPException, Query

from config import settings
from services.task_store import list_tasks, TaskStatus

router = APIRouter()

_VALID_STATUSES = {s.value for s in TaskStatus}


def _artifact_view(task) -> dict:
    params = task.params or {}
    return {
        "id": task.id,
        "status": task.status.value,
        "created_at": task.created_at,
        "images": task.images,
        "error": task.error,
        "kind": params.get("kind", "generate"),
        "skill": params.get("skill"),
        "workflow": params.get("workflow"),
        "prompt": params.get("prompt") or params.get("positive_prompt") or "",
        "params": {k: v for k, v in params.items() if k not in {"kind"}},
    }


@router.get("/artifacts")
async def get_artifacts(
    status: str = Query("done", description="done | failed | running | pending | all"),
    limit: int = Query(50, ge=1, le=500),
    skill: str = Query("", description="Filter by skill id"),
    workflow: str = Query("", description="Filter by workflow id"),
):
    if status not in _VALID_STATUSES | {"all"}:
        raise HTTPException(status_code=422, detail=f"status must be one of {_VALID_STATUSES | {'all'}}")

    tasks = await list_tasks(status=None if status == "all" else status, limit=limit * 4)
    artifacts = [_artifact_view(t) for t in tasks]
    if skill:
        artifacts = [a for a in artifacts if a["skill"] == skill]
    if workflow:
        artifacts = [a for a in artifacts if a["workflow"] == workflow]
    return {"artifacts": artifacts[:limit], "output_dir": settings.output_dir}
