"""
ComfyUI WebSocket + HTTP client.

Responsibilities:
  - Submit workflow prompts via POST /prompt
  - Subscribe to progress events via WebSocket /ws
  - Retrieve output images via GET /view
"""
import asyncio
import json
import uuid
import logging
from pathlib import Path
from typing import Any

from services.task_store import update_task

import httpx
import websockets

from config import settings

logger = logging.getLogger(__name__)

_COMFYUI_BASE = settings.comfyui_url


async def queue_prompt(workflow: dict[str, Any], client_id: str) -> str:
    """Submit a workflow to ComfyUI and return the prompt_id."""
    payload = {"prompt": workflow, "client_id": client_id}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{_COMFYUI_BASE}/prompt", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["prompt_id"]


async def wait_for_completion(
    prompt_id: str,
    client_id: str,
    task_id: str | None = None,
    timeout: float = 1200.0,
) -> list[str]:
    """
    Connect to ComfyUI WebSocket and wait until the prompt finishes.
    Returns a list of output image filenames.
    """
    ws_url = _COMFYUI_BASE.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_url}/ws?clientId={client_id}"

    output_images: list[str] = []

    async def _listen():
        async with websockets.connect(ws_url) as ws:
            while True:
                raw = await ws.recv()
                if isinstance(raw, bytes):
                    continue   # binary preview frames, skip
                msg = json.loads(raw)
                mtype = msg.get("type")

                if mtype == "executing":
                    data = msg.get("data", {})
                    if data.get("node") is None and data.get("prompt_id") == prompt_id:
                        # Execution finished
                        break

                elif mtype == "executed":
                    data = msg.get("data", {})
                    if data.get("prompt_id") == prompt_id:
                        def _collect_images(obj: Any) -> None:
                            if isinstance(obj, dict):
                                imgs = obj.get("images")
                                if isinstance(imgs, list):
                                    output_images.extend(
                                        i["filename"] for i in imgs
                                        if isinstance(i, dict) and i.get("filename")
                                    )
                                else:
                                    for v in obj.values():
                                        _collect_images(v)
                            elif isinstance(obj, list):
                                for v in obj:
                                    _collect_images(v)

                        _collect_images(data.get("output"))

                elif mtype == "progress":
                    data = msg.get("data", {})
                    val = data.get("value", 0)
                    max_val = data.get("max", 1)
                    if task_id and max_val > 0:
                        pct = 30 + int((val / max_val) * 70)
                        if pct > 99:
                            pct = 99
                        await update_task(task_id, progress=pct)

    try:
        await asyncio.wait_for(_listen(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("ComfyUI prompt %s timed out after %ss", prompt_id, timeout)

    return output_images


async def get_image_bytes(filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
    """Download an output image from ComfyUI."""
    params = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(f"{_COMFYUI_BASE}/view", params=params)
        resp.raise_for_status()
        return resp.content


async def get_system_stats() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_COMFYUI_BASE}/system_stats")
        resp.raise_for_status()
        return resp.json()
