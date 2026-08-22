"""In-process pub/sub for studio request snapshots.

SSE handlers subscribe per-connection; every state transition publishes the
full snapshot so late subscribers resync by receiving the current list first.
"""
import asyncio
from typing import Any

_subscribers: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def publish(snapshot: dict[str, Any]) -> None:
    for q in list(_subscribers):
        q.put_nowait(snapshot)
