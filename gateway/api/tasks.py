"""
GET /api/v1/tasks/{task_id} — poll task status and result
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.task_store import get_task, TaskStatus

router = APIRouter()


class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    progress: int
    images: list[str]
    error: str | None


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """Poll the status of a generation task."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        images=[f"/images/{img}" for img in task.images],
        error=task.error,
    )
