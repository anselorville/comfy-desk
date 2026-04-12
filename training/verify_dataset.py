#!/usr/bin/env python3
"""
verify_dataset.py — 训练数据集完整性验证工具

检查：
  1. 每张图片是否有对应的 .txt caption 文件
  2. caption 文件是否为空
  3. 图片是否可正常打开（排除损坏文件）
  4. 打印统计摘要

用法：
  python verify_dataset.py --dataset ./train_dataset
  python verify_dataset.py --dataset ./train_dataset --fix  # 删除孤立文件
"""

import argparse
from pathlib import Path

from PIL import Image
from tqdm import tqdm

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def verify(dataset_dir: Path, fix: bool) -> dict:
    images = [p for p in dataset_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    txts   = {p.stem for p in dataset_dir.iterdir() if p.suffix == ".txt"}

    issues = {
        "missing_caption": [],
        "empty_caption": [],
        "broken_image": [],
        "orphan_txt": [],
    }

    print(f"数据集目录：{dataset_dir}")
    print(f"图片文件：{len(images)} 张\n")

    for img_path in tqdm(images, desc="验证", unit="img"):
        # Check caption exists
        if img_path.stem not in txts:
            issues["missing_caption"].append(img_path.name)
            if fix:
                img_path.unlink()
            continue

        # Check caption not empty
        txt_path = dataset_dir / (img_path.stem + ".txt")
        caption  = txt_path.read_text(encoding="utf-8").strip()
        if not caption:
            issues["empty_caption"].append(img_path.name)

        # Check image integrity
        try:
            Image.open(img_path).verify()
        except Exception:
            issues["broken_image"].append(img_path.name)
            if fix:
                img_path.unlink()
                txt_path.unlink(missing_ok=True)

    # Find orphan txt files
    image_stems = {p.stem for p in images}
    for txt_path in dataset_dir.iterdir():
        if txt_path.suffix == ".txt" and txt_path.stem not in image_stems:
            issues["orphan_txt"].append(txt_path.name)
            if fix:
                txt_path.unlink()

    return issues


def main():
    parser = argparse.ArgumentParser(description="验证训练数据集完整性")
    parser.add_argument("--dataset", required=True, help="数据集目录")
    parser.add_argument("--fix", action="store_true", help="自动删除无效文件（谨慎使用）")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    if not dataset_dir.exists():
        print(f"❌ 目录不存在：{dataset_dir}")
        return

    issues = verify(dataset_dir, args.fix)

    print("\n═══════════════ 验证报告 ═══════════════")
    all_ok = True
    for key, files in issues.items():
        label = {
            "missing_caption": "❌ 缺少 caption",
            "empty_caption":   "⚠️  caption 为空",
            "broken_image":    "❌ 图片损坏",
            "orphan_txt":      "⚠️  孤立 txt 文件",
        }[key]
        if files:
            all_ok = False
            print(f"\n{label}（{len(files)} 个）:")
            for f in files[:10]:
                print(f"   {f}")
            if len(files) > 10:
                print(f"   ... 共 {len(files)} 个")

    if all_ok:
        print("✅ 数据集完整，未发现问题")
    elif args.fix:
        print("\n🔧 已自动清理问题文件")

    # Count valid pairs
    images = list(dataset_dir.iterdir())
    valid_pairs = sum(
        1 for p in images
        if p.suffix.lower() in IMAGE_EXTS
        and (dataset_dir / (p.stem + ".txt")).exists()
    )
    print(f"\n📊 有效训练对：{valid_pairs} 组")


if __name__ == "__main__":
    main()
