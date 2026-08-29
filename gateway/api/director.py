"""
Director & Storyboard API Endpoints
"""
import logging
from typing import Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services import director_service
from services.director_service import CAMERA_MOVEMENTS, STYLE_PRESETS

router = APIRouter()
logger = logging.getLogger(__name__)


class PlanStoryboardRequest(BaseModel):
    synopsis: str = Field(..., min_length=2, description="Story or scene outline")
    style: str = Field("cinematic", description="Visual style preset")
    num_shots: int = Field(3, ge=1, le=10, description="Number of shots to generate")
    aspect_ratio: str = Field("16:9", description="16:9, 9:16, 1:1, 4:3")


class RenderShotRequest(BaseModel):
    preview: bool = Field(False, description="Whether to use fast preview mode")


@router.get("/director/presets")
async def get_presets():
    """Get available camera movement and style presets."""
    return {
        "camera_movements": CAMERA_MOVEMENTS,
        "styles": STYLE_PRESETS,
    }


@router.post("/director/plan")
async def plan_storyboard(req: PlanStoryboardRequest):
    """Decompose story prompt into a multi-shot storyboard plan."""
    try:
        sb = await director_service.plan_storyboard(
            synopsis=req.synopsis,
            style=req.style,
            num_shots=req.num_shots,
            aspect_ratio=req.aspect_ratio,
        )
        return sb
    except Exception as e:
        logger.exception("Failed to plan storyboard")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/director/storyboards")
async def list_storyboards(limit: int = Query(20, ge=1, le=100)):
    """List all saved storyboards."""
    return await director_service.list_storyboards(limit=limit)


@router.get("/director/storyboards/{sb_id}")
async def get_storyboard(sb_id: str):
    """Get storyboard project details."""
    sb = await director_service.get_storyboard(sb_id)
    if not sb:
        raise HTTPException(status_code=404, detail="Storyboard not found")
    return sb


@router.post("/director/storyboards/{sb_id}/shots/{shot_id}/render")
async def render_shot(sb_id: str, shot_id: str, req: RenderShotRequest = RenderShotRequest()):
    """Trigger render for a specific shot."""
    try:
        res = await director_service.render_storyboard_shot(sb_id, shot_id, preview=req.preview)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to render shot")
        raise HTTPException(status_code=500, detail=str(e))
