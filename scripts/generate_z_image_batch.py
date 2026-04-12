#!/usr/bin/env python3
"""
Batch-submit text prompts to a running ComfyUI Z-Image-Turbo workflow.

Example:
    python scripts/generate_z_image_batch.py --prompts-file scripts/z_image_prompts.txt
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import random
import re
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
import websockets


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKFLOW = ROOT / "gateway" / "workflows" / "image_z_image_turbo.json"
DEFAULT_PROMPTS = ROOT / "scripts" / "z_image_prompts.txt"
DEFAULT_OUTPUT_DIR = ROOT / "outputs" / "z-image-turbo-batch"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate images from text prompts via ComfyUI.")
    parser.add_argument("--server", default="http://127.0.0.1:8188", help="ComfyUI base URL.")
    parser.add_argument("--workflow", type=Path, default=DEFAULT_WORKFLOW, help="API-format workflow JSON.")
    parser.add_argument("--prompts-file", type=Path, default=DEFAULT_PROMPTS, help="Text file with one prompt per line.")
    parser.add_argument("--prompt", action="append", default=[], help="Prompt text. Can be repeated.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Where downloaded images are copied.")
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument("--steps", type=int, default=8)
    parser.add_argument("--cfg", type=float, default=1.0)
    parser.add_argument("--seed", type=int, default=-1, help="-1 means random seed per prompt.")
    parser.add_argument("--timeout", type=float, default=900.0, help="Seconds to wait per prompt.")
    parser.add_argument("--limit", type=int, default=0, help="Only run the first N prompts. 0 means all.")
    parser.add_argument("--filename-prefix", default="z-image-turbo/batch", help="ComfyUI SaveImage filename prefix.")
    return parser.parse_args()


def read_prompts(path: Path, inline_prompts: list[str], limit: int) -> list[str]:
    prompts = [p.strip() for p in inline_prompts if p.strip()]
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if text and not text.startswith("#"):
                prompts.append(text)
    if limit > 0:
        prompts = prompts[:limit]
    if not prompts:
        raise SystemExit(f"No prompts found. Add lines to {path} or pass --prompt.")
    return prompts


def replace_sentinels(obj: Any, params: dict[str, Any]) -> Any:
    if isinstance(obj, dict):
        return {key: replace_sentinels(value, params) for key, value in obj.items()}
    if isinstance(obj, list):
        return [replace_sentinels(value, params) for value in obj]
    if isinstance(obj, str) and obj.startswith("__") and obj.endswith("__"):
        return params.get(obj[2:-2].lower(), obj)
    return obj


def build_workflow(template: dict[str, Any], prompt: str, args: argparse.Namespace, index: int) -> tuple[dict[str, Any], int]:
    seed = args.seed if args.seed >= 0 else random.randrange(0, 2**63)
    params = {
        "positive_prompt": prompt,
        "width": args.width,
        "height": args.height,
        "steps": args.steps,
        "cfg": args.cfg,
        "seed": seed,
        "filename_prefix": f"{args.filename_prefix}_{index:03d}",
    }
    return replace_sentinels(copy.deepcopy(template), params), seed


async def queue_prompt(client: httpx.AsyncClient, server: str, workflow: dict[str, Any], client_id: str) -> str:
    response = await client.post(f"{server}/prompt", json={"prompt": workflow, "client_id": client_id})
    if response.status_code >= 400:
        raise RuntimeError(f"ComfyUI rejected workflow: {response.status_code} {response.text}")
    data = response.json()
    return data["prompt_id"]


async def wait_for_prompt(server: str, client_id: str, prompt_id: str, timeout: float) -> None:
    ws_base = server.replace("http://", "ws://").replace("https://", "wss://")
    deadline = time.monotonic() + timeout
    async with websockets.connect(f"{ws_base}/ws?clientId={client_id}") as websocket:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"Timed out waiting for prompt {prompt_id}")
            raw = await asyncio.wait_for(websocket.recv(), timeout=remaining)
            if isinstance(raw, bytes):
                continue
            message = json.loads(raw)
            if message.get("type") != "executing":
                continue
            data = message.get("data", {})
            if data.get("prompt_id") == prompt_id and data.get("node") is None:
                return


async def get_history(client: httpx.AsyncClient, server: str, prompt_id: str) -> dict[str, Any]:
    response = await client.get(f"{server}/history/{prompt_id}")
    response.raise_for_status()
    return response.json().get(prompt_id, {})


def collect_images(history: dict[str, Any]) -> list[dict[str, str]]:
    images: list[dict[str, str]] = []
    outputs = history.get("outputs", {})
    for node_output in outputs.values():
        for image in node_output.get("images", []):
            images.append(
                {
                    "filename": image["filename"],
                    "subfolder": image.get("subfolder", ""),
                    "type": image.get("type", "output"),
                }
            )
    return images


def safe_name(text: str, max_len: int = 80) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", text).strip("._-")
    return cleaned[:max_len] or "prompt"


async def download_image(
    client: httpx.AsyncClient,
    server: str,
    image: dict[str, str],
    destination: Path,
) -> None:
    query = urlencode(image)
    response = await client.get(f"{server}/view?{query}")
    response.raise_for_status()
    destination.write_bytes(response.content)


async def run_batch(args: argparse.Namespace) -> None:
    server = args.server.rstrip("/")
    template = json.loads(args.workflow.read_text(encoding="utf-8"))
    prompts = read_prompts(args.prompts_file, args.prompt, args.limit)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"ComfyUI: {server}")
    print(f"Workflow: {args.workflow}")
    print(f"Prompts: {len(prompts)}")
    print(f"Output: {args.output_dir}")

    async with httpx.AsyncClient(timeout=60) as client:
        stats = await client.get(f"{server}/system_stats")
        stats.raise_for_status()

        for index, prompt in enumerate(prompts, start=1):
            client_id = str(uuid.uuid4())
            workflow, seed = build_workflow(template, prompt, args, index)

            print(f"\n[{index}/{len(prompts)}] seed={seed}")
            print(prompt)

            started = time.monotonic()
            prompt_id = await queue_prompt(client, server, workflow, client_id)
            print(f"queued prompt_id={prompt_id}")

            await wait_for_prompt(server, client_id, prompt_id, args.timeout)
            history = await get_history(client, server, prompt_id)
            images = collect_images(history)
            if not images:
                raise RuntimeError(f"Prompt {prompt_id} finished but produced no images")

            for image_number, image in enumerate(images, start=1):
                suffix = Path(image["filename"]).suffix or ".png"
                filename = f"{index:03d}_{image_number:02d}_{safe_name(prompt)}{suffix}"
                destination = args.output_dir / filename
                await download_image(client, server, image, destination)
                print(f"saved {destination}")

            elapsed = time.monotonic() - started
            print(f"done in {elapsed:.1f}s")


def main() -> None:
    args = parse_args()
    asyncio.run(run_batch(args))


if __name__ == "__main__":
    main()
