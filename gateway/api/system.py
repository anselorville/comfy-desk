from fastapi import APIRouter
from pydantic import BaseModel
from services.gpu_manager import get_gpu_telemetry, free_comfyui_memory

router = APIRouter()

SYSTEM_MODE = "idle"
_VALID_MODES = {"idle", "generating", "training", "directing"}


class SystemMode(BaseModel):
    mode: str


def get_system_mode() -> str:
    global SYSTEM_MODE
    return SYSTEM_MODE


def set_system_mode(mode: str) -> str:
    """Set the global system mode. Returns the resulting mode."""
    global SYSTEM_MODE
    if mode in _VALID_MODES:
        SYSTEM_MODE = mode
    return SYSTEM_MODE


@router.get("/system/mode", response_model=SystemMode)
async def get_mode():
    return SystemMode(mode=get_system_mode())


@router.post("/system/mode", response_model=SystemMode)
async def set_mode(payload: SystemMode):
    return SystemMode(mode=set_system_mode(payload.mode))


@router.get("/system/gpu")
async def get_gpu():
    """Returns real-time GPU VRAM, utilization, and temperature for RTX 2080Ti (22GB)."""
    return get_gpu_telemetry()


@router.post("/system/gpu-cleanup")
async def cleanup_gpu():
    """Unload resident models and free ComfyUI VRAM."""
    success = await free_comfyui_memory()
    telemetry = get_gpu_telemetry()
    return {"success": success, "gpu": telemetry}
