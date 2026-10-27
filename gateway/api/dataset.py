import os
import aiofiles
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile
from pydantic import BaseModel
import logging

from config import settings
from api.system import get_system_mode
from services.caption_client import caption_image

router = APIRouter()
logger = logging.getLogger(__name__)

class ImageMeta(BaseModel):
    id: str
    filename: str
    has_caption: bool
    size: int

class CaptionRequest(BaseModel):
    caption: str

class BatchCaptionRequest(BaseModel):
    image_ids: list[str]
    style: str = "training"
    overwrite: bool = False

def get_dataset_path() -> Path:
    p = Path(settings.dataset_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p

@router.get("/dataset/images", response_model=list[ImageMeta])
async def list_images():
    ds = get_dataset_path()
    images = []
    for f in ds.glob("*.*"):
        if f.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
            txt_file = f.with_suffix(".txt")
            images.append(ImageMeta(
                id=f.stem,
                filename=f.name,
                has_caption=txt_file.exists(),
                size=f.stat().st_size
            ))
    return images

@router.get("/dataset/images/{id}/caption")
async def get_caption(id: str):
    ds = get_dataset_path()
    # very basic glob
    matches = list(ds.glob(f"{id}.*"))
    img_file = next((m for m in matches if m.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]), None)
    if not img_file:
        raise HTTPException(status_code=404, detail="Image not found")
    
    txt_file = img_file.with_suffix(".txt")
    if not txt_file.exists():
        return {"caption": ""}
    
    async with aiofiles.open(txt_file, mode="r") as f:
        content = await f.read()
    return {"caption": content}

@router.put("/dataset/images/{id}/caption")
async def update_caption(id: str, req: CaptionRequest):
    ds = get_dataset_path()
    matches = list(ds.glob(f"{id}.*"))
    img_file = next((m for m in matches if m.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]), None)
    if not img_file:
        raise HTTPException(status_code=404, detail="Image not found")
        
    txt_file = img_file.with_suffix(".txt")
    async with aiofiles.open(txt_file, mode="w") as f:
        await f.write(req.caption)
    return {"status": "ok"}

async def _batch_caption_job(
    image_ids: list[str], style: str = "training", overwrite: bool = False
):
    """Caption each image with JoyCaption and write the result next to it as .txt."""
    ds = get_dataset_path()
    ok = skipped = failed = 0

    for pid in image_ids:
        matches = list(ds.glob(f"{pid}.*"))
        img_file = next(
            (m for m in matches if m.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]),
            None,
        )
        if not img_file:
            logger.warning("batch caption: image not found: %s", pid)
            failed += 1
            continue

        txt_file = img_file.with_suffix(".txt")
        if txt_file.exists() and not overwrite:
            skipped += 1
            continue

        try:
            async with aiofiles.open(img_file, mode="rb") as f:
                raw = await f.read()
            caption = await caption_image(raw, style=style)
        except Exception as e:
            logger.error("batch caption failed for %s: %s", pid, e)
            failed += 1
            continue

        if not caption:
            logger.warning("batch caption: empty caption for %s", pid)
            failed += 1
            continue

        async with aiofiles.open(txt_file, mode="w") as f:
            await f.write(caption)
        ok += 1
        logger.info("batch caption: %s -> %s", pid, caption[:60])

    logger.info("batch caption done: ok=%d skipped=%d failed=%d", ok, skipped, failed)

@router.post("/dataset/caption-batch")
async def caption_batch(req: BatchCaptionRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        _batch_caption_job, req.image_ids, req.style, req.overwrite
    )
    return {"status": "started", "count": len(req.image_ids)}
