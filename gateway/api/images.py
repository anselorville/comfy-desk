"""
GET /images/{filename} — proxy output images from ComfyUI
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from services import comfy_client

router = APIRouter()


@router.get("/images/{filename}")
async def get_image(filename: str, subfolder: str = Query(""), type: str = Query("output")):
    """Proxy an output image from ComfyUI's /view endpoint."""
    try:
        data = await comfy_client.get_image_bytes(filename, subfolder=subfolder, folder_type=type)
        ext = filename.lower().rsplit(".", 1)[-1]
        media_type = {
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "webp": "image/webp", "gif": "image/gif",
            "mp4": "video/mp4", "webm": "video/webm",
        }.get(ext, "application/octet-stream")
        return Response(content=data, media_type=media_type)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Image not found: {exc}")
