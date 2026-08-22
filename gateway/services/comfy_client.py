"""ComfyUI client — queue prompts, wait via WebSocket, fetch/upload images."""
import asyncio
import json
import logging
from typing import Any

import httpx
import websockets

from config import settings
from services.task_store import update_task

logger = logging.getLogger(__name__)

_COMFYUI_BASE = settings.comfyui_url


async def queue_prompt(workflow: dict[str, Any], client_id: str) -> str:
    """Submit a workflow to ComfyUI and return the prompt_id."""
    payload = {"prompt": workflow, "client_id": client_id}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{_COMFYUI_BASE}/prompt", json=payload)
        resp.raise_for_status()
        return resp.json()["prompt_id"]


def _collect_images(obj: Any) -> list[str]:
    """Recursively collect [{'filename': ...}] entries from any message shape.

    Handles both old frames (`output` is the node output dict directly) and
    node-id-keyed frames, plus arbitrary nesting seen across engine versions.
    """
    out: list[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            imgs = node.get("images")
            if isinstance(imgs, list):
                out.extend(
                    i["filename"] for i in imgs
                    if isinstance(i, dict) and i.get("filename")
                )
            else:
                for v in node.values():
                    _walk(v)
        elif isinstance(node, list):
            for v in node:
                _walk(v)

    _walk(obj)
    return out


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


async def get_system_stats() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_COMFYUI_BASE}/system_stats")
        resp.raise_for_status()
        return resp.json()
