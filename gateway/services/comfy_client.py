"""
Async client for the ComfyUI HTTP + WebSocket API.

Connects to ComfyUI (default http://comfyui:8188) to:
- POST /prompt: submit a workflow graph
- WS /ws: listen for progress, error, and completion events
- GET /view: retrieve output image bytes
- GET /history: retrieve execution history
- POST /upload/image: upload reference images
"""
import asyncio
import json
import logging
from typing import Any

import httpx
import websockets

from config import settings
from services.task_store import update_task

logger = logging.getLogger(__name__)

_COMFYUI_BASE = settings.comfyui_url.rstrip("/")


async def queue_prompt(workflow: dict[str, Any], client_id: str) -> str:
    """Submit a workflow to ComfyUI; returns prompt_id."""
    payload = {"prompt": workflow, "client_id": client_id}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{_COMFYUI_BASE}/prompt", json=payload)
        resp.raise_for_status()
        return resp.json()["prompt_id"]


def _collect_images(obj: Any) -> list[str]:
    """Recursively collect output image/video filenames from message or history payload."""
    out: list[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            for field in ("images", "videos", "gifs", "files"):
                items = node.get(field)
                if isinstance(items, list):
                    for i in items:
                        if isinstance(i, dict) and i.get("filename"):
                            out.append(i["filename"])
            for v in node.values():
                _walk(v)
        elif isinstance(node, list):
            for v in node:
                _walk(v)

    _walk(obj)
    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for x in out:
        if x not in seen:
            seen.add(x)
            deduped.append(x)
    return deduped


async def wait_for_completion(
    prompt_id: str,
    client_id: str,
    task_id: str | None = None,
    timeout: float = 1200.0,
) -> list[str]:
    """
    Connect to ComfyUI WebSocket and wait until the prompt finishes.
    Returns a list of output image/video filenames.
    Raises RuntimeError when the engine reports execution_error.
    """
    ws_url = _COMFYUI_BASE.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_url}/ws?clientId={client_id}"

    output_images: list[str] = []

    async def _listen():
        async with websockets.connect(ws_url, max_size=2**24) as ws:
            while True:
                raw = await ws.recv()
                if isinstance(raw, bytes):
                    continue   # binary preview frames, skip
                msg = json.loads(raw)
                mtype = msg.get("type")
                data = msg.get("data", {}) or {}

                if mtype == "executing":
                    if data.get("node") is None and data.get("prompt_id") == prompt_id:
                        break   # finished (fallback signal)

                elif mtype == "execution_success":
                    if data.get("prompt_id") == prompt_id:
                        break

                elif mtype == "execution_error":
                    if data.get("prompt_id") == prompt_id:
                        raise RuntimeError(
                            f"引擎执行失败 @节点{data.get('node_type')}: {data.get('exception_message')}"
                        )

                elif mtype == "executed":
                    if data.get("prompt_id") == prompt_id:
                        output_images.extend(_collect_images(data.get("output")))

                elif mtype == "progress":
                    val = data.get("value", 0)
                    max_val = data.get("max", 1)
                    if task_id and max_val:
                        pct = 30 + int((val / max_val) * 70)
                        await update_task(task_id, progress=min(pct, 99))

    try:
        await asyncio.wait_for(_listen(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("ComfyUI prompt %s timed out after %ss", prompt_id, timeout)
    except Exception as e:
        logger.warning("WebSocket listener notice: %s", e)

    # Robust fallback: fetch history from ComfyUI REST API if output_images is empty
    if not output_images:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                h_resp = await client.get(f"{_COMFYUI_BASE}/history/{prompt_id}")
                if h_resp.status_code == 200:
                    history = h_resp.json().get(prompt_id, {})
                    outputs = history.get("outputs", {})
                    output_images.extend(_collect_images(outputs))
        except Exception as e:
            logger.warning("History fallback query failed: %s", e)

    return output_images


async def get_image_bytes(filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
    """Download an output image/video from ComfyUI."""
    params = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(f"{_COMFYUI_BASE}/view", params=params)
        resp.raise_for_status()
        return resp.content


async def upload_image(data: bytes, filename: str, overwrite: bool = True) -> str:
    """Upload a reference image into ComfyUI's input dir; returns stored filename."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{_COMFYUI_BASE}/upload/image",
            data={"overwrite": "true" if overwrite else "false", "type": "input"},
            files={"image": (filename, data, "application/octet-stream")},
        )
        resp.raise_for_status()
        return resp.json()["name"]


async def get_system_stats() -> dict[str, Any]:
    """Fetch system statistics and GPU state from ComfyUI."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_COMFYUI_BASE}/system_stats")
        resp.raise_for_status()
        return resp.json()
