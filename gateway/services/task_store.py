"""
SQLite-backed task store.
"""
import asyncio
import uuid
import json
from enum import Enum
from typing import Any
from dataclasses import dataclass, field
import aiosqlite
import os

DB_PATH = os.environ.get("COMFYUI_OUTPUT_DIR", "outputs") + "/tasks.sqlite"

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


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                status TEXT,
                progress INTEGER,
                images TEXT,
                error TEXT,
                params TEXT
            )
        ''')
        await db.commit()


async def create_task(**params) -> Task:
    task = Task(id=str(uuid.uuid4()), params=params)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO tasks (id, status, progress, images, error, params) VALUES (?, ?, ?, ?, ?, ?)",
            (task.id, task.status.value, task.progress, json.dumps(task.images), task.error, json.dumps(task.params))
        )
        await db.commit()
    return task


async def get_task(task_id: str) -> Task | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, status, progress, images, error, params FROM tasks WHERE id = ?", (task_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return Task(
                    id=row[0],
                    status=TaskStatus(row[1]),
                    progress=row[2],
                    images=json.loads(row[3]),
                    error=row[4],
                    params=json.loads(row[5])
                )
    return None


async def update_task(task_id: str, **kwargs):
    task = await get_task(task_id)
    if task:
        for k, v in kwargs.items():
            setattr(task, k, v)
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE tasks SET status = ?, progress = ?, images = ?, error = ?, params = ? WHERE id = ?",
                (task.status.value, task.progress, json.dumps(task.images), task.error, json.dumps(task.params), task.id)
            )
            await db.commit()
