#!/usr/bin/env python3
"""
resize_images.py — 数据集图片预处理工具

功能：
  - 统一分辨率（默认长边 1024）
  - 转换格式为 PNG
  - 去除 EXIF 信息
  - 过滤过小的图片（默认 < 512px 的跳过）
  - 可选：跳过重复图片（基于 MD5）

用法：
  python resize_images.py --input ./raw_images --output ./processed --size 1024
"""

import argparse
import asyncio
import hashlib
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageOps
from tqdm import tqdm

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}


def process_image(
    src: Path,
    dst_dir: Path,
    max_size: int,
    min_size: int,
    seen_hashes: set[str],
    dedupe: bool,
) -> tuple[str, str]:
    """
    Returns (status, message) where status is 'ok' | 'skip' | 'error'.
    """
    try:
        img = Image.open(src)
        w, h = img.size

        # Filter too-small images
        if min(w, h) < min_size:
            return "skip", f"too small ({w}x{h})"

        # Deduplication by MD5
        if dedupe:
            raw = src.read_bytes()
            md5 = hashlib.md5(raw).hexdigest()
            if md5 in seen_hashes:
                return "skip", "duplicate"
            seen_hashes.add(md5)

        # Convert to RGB (handles RGBA, L, P modes)
        img = img.convert("RGB")

        # Auto-orient based on EXIF
        img = ImageOps.exif_transpose(img)

        # Resize: keep aspect ratio, longest side = max_size
        if max(w, h) > max_size:
            ratio = max_size / max(w, h)
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        # Save as PNG (lossless, no EXIF)
        dst = dst_dir / (src.stem + ".png")
        img.save(dst, format="PNG", optimize=True)
        return "ok", f"{img.width}x{img.height}"

    except Exception as e:
        return "error", str(e)


def main():
    parser = argparse.ArgumentParser(description="数据集图片预处理（resize + 格式统一）")
    parser.add_argument("--input",    required=True, help="原始图片目录")
    parser.add_argument("--output",   required=True, help="输出目录")
    parser.add_argument("--size",     type=int, default=1024, help="最大边长（默认 1024）")
    parser.add_argument("--min-size", type=int, default=512,  help="最小边长，小于此值跳过")
    parser.add_argument("--dedupe",   action="store_true",    help="跳过重复图片（MD5）")
    args = parser.parse_args()

    input_dir  = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    images = [p for p in input_dir.rglob("*") if p.suffix.lower() in IMAGE_EXTS]
    print(f"找到 {len(images)} 张图片，开始处理...")

    seen_hashes: set[str] = set()
    stats = {"ok": 0, "skip": 0, "error": 0}

    for img_path in tqdm(images, unit="img"):
        status, msg = process_image(
            img_path, output_dir, args.size, args.min_size, seen_hashes, args.dedupe
        )
        stats[status] += 1
        if status != "ok":
            tqdm.write(f"  [{status.upper()}] {img_path.name}: {msg}")

    print(f"\n✅ 完成：{stats['ok']} 处理 | {stats['skip']} 跳过 | {stats['error']} 错误")
    print(f"   输出目录：{output_dir}")


if __name__ == "__main__":
    main()
