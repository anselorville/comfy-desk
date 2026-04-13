"""
POST /api/v1/generate — submit a text-to-image task
GET  /api/v1/generate/{task_id}/status — alias for /tasks/{task_id}
"""
import asyncio
import uuid
import logging

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from services import comfy_client
from services.task_store import create_task, update_task, TaskStatus
from services.workflow_loader import load_workflow, inject_params
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


async def _run_generation(task_id: str, request: GenerateRequest):
    client_id = str(uuid.uuid4())
    try:
        await update_task(task_id, status=TaskStatus.RUNNING, progress=10)

        # Build workflow params
        seed = request.seed if request.seed >= 0 else int(uuid.uuid4().int % 2**32)
        params = {
            "positive_prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "steps": request.steps,
            "cfg": request.cfg,
            "width": request.width,
            "height": request.height,
            "seed": seed,
            "lora": request.lora,
            "lora_strength": request.lora_strength,
        }

        wf = load_workflow(request.workflow)
        wf = inject_params(wf, params)

        await update_task(task_id, progress=20)

        prompt_id = await comfy_client.queue_prompt(wf, client_id)
        await update_task(task_id, progress=30)

        images = await comfy_client.wait_for_completion(prompt_id, client_id)
        await update_task(task_id, status=TaskStatus.DONE, progress=100, images=images)

    except Exception as exc:
        logger.exception("Generation task %s failed", task_id)
        await update_task(task_id, status=TaskStatus.FAILED, error=str(exc))


@router.post("/generate")
async def generate(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Submit a text-to-image generation task. Returns task_id for polling."""
    if get_system_mode() == "training":
        raise HTTPException(status_code=409, detail="System is occupied by training")
    task = await create_task(**request.model_dump())
    background_tasks.add_task(_run_generation, task.id, request)
    return {"task_id": task.id, "status": "pending"}
