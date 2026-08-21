"""
SQLite-backed task store.
"""
import asyncio
import uuid
import json
from datetime import datetime, timezone
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
    created_at: str = ""


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
                params TEXT,
                created_at TEXT DEFAULT ''
            )
        ''')
        # Migration for pre-existing DBs without created_at
        try:
            await db.execute("ALTER TABLE tasks ADD COLUMN created_at TEXT DEFAULT ''")
        except aiosqlite.OperationalError:
            pass  # column already exists
        await db.commit()


async def create_task(**params) -> Task:
    task = Task(
        id=str(uuid.uuid4()),
        params=params,
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO tasks (id, status, progress, images, error, params, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (task.id, task.status.value, task.progress, json.dumps(task.images), task.error, json.dumps(task.params), task.created_at)
        )
        await db.commit()
    return task


async def get_task(task_id: str) -> Task | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id, status, progress, images, error, params, created_at FROM tasks WHERE id = ?", (task_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return Task(
                    id=row[0],
                    status=TaskStatus(row[1]),
                    progress=row[2],
                    images=json.loads(row[3]),
                    error=row[4],
                    params=json.loads(row[5]),
                    created_at=row[6],
                )
    return None


async def list_tasks(status: str | None = None, limit: int = 50) -> list[Task]:
    """Most recent tasks first; optional status filter ('done', 'failed', ...)."""
    query = "SELECT id, status, progress, images, error, params, created_at FROM tasks"
    args: tuple = ()
    if status:
        query += " WHERE status = ?"
        args = (status,)
    query += " ORDER BY created_at DESC, rowid DESC LIMIT ?"
    args += (limit,)
    tasks = []
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(query, args) as cursor:
            for row in await cursor.fetchall():
                tasks.append(Task(
                    id=row[0],
                    status=TaskStatus(row[1]),
                    progress=row[2],
                    images=json.loads(row[3]),
                    error=row[4],
                    params=json.loads(row[5]),
                    created_at=row[6],
                ))
    return tasks


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
