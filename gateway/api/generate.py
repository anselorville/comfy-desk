"""
POST /api/v1/generate — submit a text-to-image task
GET  /api/v1/generate/{task_id}/status — alias for /tasks/{task_id}
"""
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks, File, Form, UploadFile
from pydantic import BaseModel, Field

from services import comfy_client, gpu_watchdog
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
    length: int = Field(121, ge=1, le=999, description="Video frames at 24fps (video workflows only)")

@router.post("/generate")
async def generate(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Submit a text-to-image generation task. Returns task_id for polling."""
    if get_system_mode() == "training":
        raise HTTPException(status_code=409, detail="System is occupied by training")
    task = await create_task(kind="generate", **request.model_dump())
    gpu_watchdog.touch()
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


@router.post("/generate/auto")
async def generate_auto(
    background_tasks: BackgroundTasks,
    prompt: str = Form(...),
    negative_prompt: str = Form(""),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int = Form(-1),
    image: UploadFile | None = File(None),
):
    """
    智能生成:平台固定模型与规范参数。
    无参考图 → Z-Image Turbo 文生图;附参考图 → Wan2.2 I2V 角色锚定视频(首帧=参考图)。
    """
    if get_system_mode() == "training":
        raise HTTPException(status_code=409, detail="System is occupied by training")

    image_filename = ""
    if image and image.filename:
        data = await image.read()
        ext = Path(image.filename).suffix.lower().lstrip(".") or "png"
        image_filename = f"auto_{uuid.uuid4().hex[:12]}.{ext}"
        upload_dir = Path(__file__).parent.parent / "uploads"
        upload_dir.mkdir(exist_ok=True)
        (upload_dir / image_filename).write_bytes(data)

    if image_filename:
        workflow = "video_wan22_ti2v_5b_i2v"
        length = 121
        stored = await comfy_client.upload_image(
            (Path(__file__).parent.parent / "uploads" / image_filename).read_bytes(),
            image_filename,
        )
    else:
        workflow = "image_z_image_turbo"
        length = None
        stored = ""

    params = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "workflow": workflow,
        "steps": 8 if not image_filename else 20,
        "cfg": 1.0 if not image_filename else 5.0,
        "width": width,
        "height": height,
        "seed": seed,
    }
    runner_params = {
        **params,
        "positive_prompt": prompt,
        "filename_prefix": f"comfydesk_{uuid.uuid4().hex[:8]}",
    }
    if stored:
        runner_params["image_filename"] = stored
    if length:
        runner_params["length"] = length

    task = await create_task(kind="generate", **params)
    gpu_watchdog.touch()
    background_tasks.add_task(run_generation_task, task.id, workflow, runner_params)
    return {"task_id": task.id, "status": "pending"}
