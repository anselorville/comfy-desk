import os
import aiofiles
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile
from pydantic import BaseModel
import logging

from config import settings
from api.system import get_system_mode
# We will use caption_client later
# from services.caption_client import get_caption

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

async def _batch_caption_job(image_ids: list[str]):
    # This simulates joycaption processing for the sake of the task.
    # In reality it should call the caption_client! 
    # For now, it writes a placeholder.
    ds = get_dataset_path()
    for pid in image_ids:
        matches = list(ds.glob(f"{pid}.*"))
        img_file = next((m for m in matches if m.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]), None)
        if img_file:
            txt_file = img_file.with_suffix(".txt")
            if not txt_file.exists():
                async with aiofiles.open(txt_file, mode="w") as f:
                    await f.write("batch generated placeholder caption")

@router.post("/dataset/caption-batch")
async def caption_batch(req: BatchCaptionRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_batch_caption_job, req.image_ids)
    return {"status": "started", "count": len(req.image_ids)}
