"""
GET /api/v1/tasks/{task_id} — poll task status and result
"""
from fastapi import APIRouter, HTTPException
import asyncio
import json
from sse_starlette.sse import EventSourceResponse
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
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        images=[f"/images/{img}" for img in task.images],
        error=task.error,
    )

@router.get("/tasks/{task_id}/stream")
async def stream_task_status(task_id: str):
    """EventSource stream yielding task updates."""
    async def event_generator():
        last_progress = -1
        last_status = None
        while True:
            t = await get_task(task_id)
            if not t:
                yield {"event": "error", "data": "task_not_found"}
                break
            
            if t.progress != last_progress or t.status.value != last_status:
                last_progress = t.progress
                last_status = t.status.value
                data = json.dumps({
                    "task_id": t.id,
                    "status": t.status.value,
                    "progress": t.progress,
                    "images": [f"/images/{img}" for img in t.images],
                    "error": t.error
                })
                yield {"event": "progress", "data": data}
            
            if t.status.value in ["done", "failed"]:
                break
                
            await asyncio.sleep(1.0)
            
    return EventSourceResponse(event_generator())
