"""GPU idle watchdog — releases VRAM when the engine sits unused.

ComfyUI keeps model weights resident between jobs ("smart memory"), which
bakes the GPU at high memory usage indefinitely. This watchdog notices idle
periods (no running/pending queue items) and calls the engine's /free
endpoint to unload models, so the card cools down between creative sessions.

Config: GPU_IDLE_UNLOAD_SEC (default 600) — idle seconds before unloading.
"""
import asyncio
import logging
import os
import time

import httpx

from config import settings

logger = logging.getLogger(__name__)

IDLE_SEC = int(os.environ.get("GPU_IDLE_UNLOAD_SEC", "600"))
CHECK_INTERVAL = 60

_last_touch = time.monotonic()


def touch() -> None:
    """Mark GPU as 'in use' — called whenever a job is submitted/progressing."""
    global _last_touch
    _last_touch = time.monotonic()


async def _maybe_free() -> bool:
    """Unload models iff queue is empty AND idle threshold exceeded."""
    base = settings.comfyui_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{base}/queue")
            if resp.status_code != 200:
                return False
            queue = resp.json()
            if queue.get("queue_running") or queue.get("queue_pending"):
                touch()
                return False
            if time.monotonic() - _last_touch < IDLE_SEC:
                return False
            f_resp = await client.post(
                f"{base}/free", json={"unload_models": True, "free_memory": True}
            )
            f_resp.raise_for_status()
            logger.info("GPU 空闲超过 %ss,已卸载模型并释放显存", IDLE_SEC)
            return True
    except (httpx.ConnectError, httpx.TimeoutException):
        # ComfyUI is not reachable or stopped
        return False
    except Exception as e:
        logger.debug("GPU watchdog notice: %s", e)
        return False


async def _loop() -> None:
    while True:
        try:
            await _maybe_free()
        except Exception:
            pass
        await asyncio.sleep(CHECK_INTERVAL)


def start() -> asyncio.Task:
    return asyncio.create_task(_loop())
