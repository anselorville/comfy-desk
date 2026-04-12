"""
In-memory task store — sufficient for single-node deployment.
Replace with Redis-backed store for multi-worker scalability.
"""
import asyncio
import uuid
from enum import Enum
from typing import Any
from dataclasses import dataclass, field


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0          # 0-100
    images: list[str] = field(default_factory=list)
    error: str | None = None
    params: dict[str, Any] = field(default_factory=dict)


_store: dict[str, Task] = {}


def create_task(**params) -> Task:
    task = Task(id=str(uuid.uuid4()), params=params)
    _store[task.id] = task
    return task


def get_task(task_id: str) -> Task | None:
    return _store.get(task_id)


def update_task(task_id: str, **kwargs):
    task = _store.get(task_id)
    if task:
        for k, v in kwargs.items():
            setattr(task, k, v)
