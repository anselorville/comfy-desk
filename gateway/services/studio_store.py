"""Studio request store — SQLite persistence for mobile workbench requests.

One row per natural-language request (optionally with a character reference
image). The studio agent drives status transitions; the mobile UI reads
snapshots and subscribes to live updates via the event bus.
"""
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

import aiosqlite

DB_PATH = Path(__file__).parent.parent / "studio.db"


class RequestStatus(str, Enum):
    QUEUED = "queued"
    THINKING = "thinking"
    SUBMITTED = "submitted"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS studio_requests (
                id TEXT PRIMARY KEY,
                message TEXT NOT NULL,
                ref_image TEXT DEFAULT '',
                status TEXT DEFAULT 'queued',
                detail TEXT DEFAULT '',
                progress INTEGER DEFAULT 0,
                task_id TEXT DEFAULT '',
                result_url TEXT DEFAULT '',
                params TEXT DEFAULT '{}',
                created_at TEXT DEFAULT '',
                updated_at TEXT DEFAULT ''
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                endpoint TEXT PRIMARY KEY,
                keys TEXT NOT NULL,
                created_at TEXT DEFAULT ''
            )
        ''')
        await db.commit()


async def create_request(message: str, ref_image: str = "") -> dict[str, Any]:
    req = {
        "id": str(uuid.uuid4()),
        "message": message,
        "ref_image": ref_image,
        "status": RequestStatus.QUEUED.value,
        "detail": "",
        "progress": 0,
        "task_id": "",
        "result_url": "",
        "params": "{}",
    }
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    req["created_at"] = now
    req["updated_at"] = now
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO studio_requests (id, message, ref_image, status, detail, progress, task_id, result_url, params, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (req["id"], req["message"], req["ref_image"], req["status"], req["detail"],
             req["progress"], req["task_id"], req["result_url"], req["params"],
             req["created_at"], req["updated_at"]),
        )
        await db.commit()
    return req


async def update_request(request_id: str, **fields: Any) -> dict[str, Any] | None:
    if not fields:
        return await get_request(request_id)
    fields = {
        k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v)
        for k, v in fields.items()
    }
    fields["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    cols = ", ".join(f"{k} = ?" for k in fields)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE studio_requests SET {cols} WHERE id = ?",
            (*fields.values(), request_id),
        )
        await db.commit()
    return await get_request(request_id)


async def get_request(request_id: str) -> dict[str, Any] | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM studio_requests WHERE id = ?", (request_id,)
        ) as cursor:
            row = await cursor.fetchone()
    return _row_to_dict(row) if row else None


async def list_requests(limit: int = 50) -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM studio_requests ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
    return [_row_to_dict(r) for r in rows]


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    d = dict(row)
    try:
        d["params"] = json.loads(d.get("params") or "{}")
    except json.JSONDecodeError:
        d["params"] = {}
    return d


# ── push subscriptions ────────────────────────────────────────────────────────

async def add_subscription(endpoint: str, keys: dict[str, str]) -> None:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO push_subscriptions (endpoint, keys, created_at) VALUES (?, ?, ?)"
            " ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys",
            (endpoint, json.dumps(keys), now),
        )
        await db.commit()


async def list_subscriptions() -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT endpoint, keys FROM push_subscriptions") as cursor:
            rows = await cursor.fetchall()
    out = []
    for r in rows:
        try:
            out.append({"endpoint": r["endpoint"], "keys": json.loads(r["keys"])})
        except json.JSONDecodeError:
            continue
    return out
