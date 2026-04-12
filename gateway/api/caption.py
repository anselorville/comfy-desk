"""
POST /api/v1/caption — upload an image, get JoyCaption description
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from services.caption_client import caption_image, CAPTION_PROMPTS

router = APIRouter()


class CaptionResponse(BaseModel):
    caption: str
    style: str


@router.post("/caption", response_model=CaptionResponse)
async def create_caption(
    file: UploadFile = File(..., description="Image to caption (PNG/JPG/WEBP)"),
    style: str = Form("tags", description=f"Caption style: {list(CAPTION_PROMPTS)}"),
    max_tokens: int = Form(512),
    temperature: float = Form(0.7),
):
    """
    Upload an image → receive a JoyCaption text description.
    Useful for building training datasets and prompt engineering.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format")

    image_bytes = await file.read()
    if len(image_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 50MB)")

    caption = await caption_image(
        image_bytes,
        style=style,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return CaptionResponse(caption=caption, style=style)


@router.get("/caption/styles")
async def list_styles():
    """List available caption styles."""
    return {"styles": list(CAPTION_PROMPTS.keys())}
