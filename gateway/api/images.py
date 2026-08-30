"""
GET /images/{filename} — proxy output images from ComfyUI
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from services import comfy_client
from config import settings

router = APIRouter()


@router.api_route("/images/{filename}", methods=["GET", "HEAD"])
async def get_image(filename: str, request: Request, subfolder: str = Query(""), type: str = Query("output")):
    """Proxy an output image/video from ComfyUI."""
    try:
        # First try direct file read from comfy-ui output directory if available locally
        output_dir = Path(__file__).parent.parent.parent / "comfy-ui" / "output"
        local_file = output_dir / filename
        if local_file.exists() and local_file.is_file():
            data = local_file.read_bytes()
        else:
            data = await comfy_client.get_image_bytes(filename, subfolder=subfolder, folder_type=type)

        ext = filename.lower().rsplit(".", 1)[-1]
        media_type = {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "webp": "image/webp",
            "gif": "image/gif",
            "mp4": "video/mp4",
            "webm": "video/webm",
        }.get(ext, "application/octet-stream")

        headers = {
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "public, max-age=31536000, immutable",
        }
        if request.method == "HEAD":
            return Response(status_code=200, media_type=media_type, headers=headers)
        return Response(content=data, media_type=media_type, headers=headers)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Image not found: {exc}")
