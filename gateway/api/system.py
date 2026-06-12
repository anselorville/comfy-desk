from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

SYSTEM_MODE = "idle"
_VALID_MODES = {"idle", "generating", "training"}


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
