#!/usr/bin/env python3
"""
prepare_dataset.py — Batch image annotation using the ComfyDesk caption API.

Usage:
  python prepare_dataset.py \\
    --input  ./raw_images/ \\
    --output ./train_dataset/ \\
    --style  training \\
    --api    http://localhost/api/v1

This script:
  1. Reads all images from --input
  2. Posts each image to /api/v1/caption
  3. Saves {image_name}.txt alongside a copy of the image in --output
     (following kohya_ss flat-directory convention)
"""

import argparse
import asyncio
import shutil
import sys
from pathlib import Path

import httpx

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
API_TIMEOUT = 120


async def caption_one(
    client: httpx.AsyncClient,
    api_base: str,
    image_path: Path,
    style: str,
) -> str:
    with open(image_path, "rb") as f:
        files = {"file": (image_path.name, f, "image/jpeg")}
        data = {"style": style, "max_tokens": 512, "temperature": 0.5}
        resp = await client.post(f"{api_base}/caption", files=files, data=data)
    resp.raise_for_status()
    return resp.json()["caption"]


async def process_all(
    input_dir: Path,
    output_dir: Path,
    api_base: str,
    style: str,
    concurrency: int,
):
    images = [p for p in input_dir.rglob("*") if p.suffix.lower() in IMAGE_EXTS]
    print(f"Found {len(images)} images in {input_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(concurrency)

    async def process(img: Path):
        async with sem:
            dst_img = output_dir / img.name
            dst_txt = dst_img.with_suffix(".txt")

            if dst_txt.exists():
                print(f"  [SKIP] {img.name} (caption already exists)")
                return

            try:
                async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                    caption = await caption_one(client, api_base, img, style)

                # Copy image
                shutil.copy2(img, dst_img)
                # Write caption
                dst_txt.write_text(caption, encoding="utf-8")
                print(f"  [OK]   {img.name}")
                print(f"         → {caption[:80]}...")
            except Exception as e:
                print(f"  [ERR]  {img.name}: {e}", file=sys.stderr)

    await asyncio.gather(*[process(img) for img in images])
    print(f"\nDataset ready in: {output_dir}")
    print(f"Total captioned: {len(list(output_dir.glob('*.txt')))}")


def main():
    parser = argparse.ArgumentParser(description="Batch caption images with JoyCaption")
    parser.add_argument("--input",       required=True, help="Input images directory")
    parser.add_argument("--output",      required=True, help="Output dataset directory")
    parser.add_argument("--api",         default="http://localhost/api/v1", help="ComfyDesk API base URL")
    parser.add_argument("--style",       default="training", choices=["tags", "descriptive", "short", "training"])
    parser.add_argument("--concurrency", type=int, default=3, help="Max parallel requests")
    args = parser.parse_args()

    asyncio.run(process_all(
        Path(args.input),
        Path(args.output),
        args.api,
        args.style,
        args.concurrency,
    ))


if __name__ == "__main__":
    main()
