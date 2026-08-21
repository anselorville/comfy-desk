"""
POST /api/v1/generate — submit a text-to-image task
GET  /api/v1/generate/{task_id}/status — alias for /tasks/{task_id}
"""
import logging

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from services.task_store import create_task
from services.generation_runner import run_generation_task
from api.system import get_system_mode

router = APIRouter()
logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Positive prompt / text description")
    negative_prompt: str = Field("", description="Negative prompt")
    workflow: str = Field("txt2img_sdxl", description="Workflow template name")
    steps: int = Field(20, ge=1, le=150)
    cfg: float = Field(7.0, ge=1.0, le=30.0)
    width: int = Field(1024, ge=256, le=2048)
    height: int = Field(1024, ge=256, le=2048)
    seed: int = Field(-1, description="-1 for random")
    lora: str = Field("", description="Optional LoRA filename (without extension)")
    lora_strength: float = Field(0.8, ge=0.0, le=2.0)

@router.post("/generate")
async def generate(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Submit a text-to-image generation task. Returns task_id for polling."""
    if get_system_mode() == "training":
        raise HTTPException(status_code=409, detail="System is occupied by training")
    task = await create_task(kind="generate", **request.model_dump())
    background_tasks.add_task(
        run_generation_task,
        task.id,
        request.workflow,
        {
            **request.model_dump(),
            "positive_prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "filename_prefix": f"comfydesk_{task.id[:8]}",
        },
    )
    return {"task_id": task.id, "status": "pending"}
