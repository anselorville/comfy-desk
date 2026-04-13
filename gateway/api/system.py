from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

SYSTEM_MODE = "idle"

class SystemMode(BaseModel):
    mode: str

def get_system_mode() -> str:
    global SYSTEM_MODE
    return SYSTEM_MODE

@router.get("/system/mode", response_model=SystemMode)
async def get_mode():
    return SystemMode(mode=get_system_mode())

@router.post("/system/mode", response_model=SystemMode)
async def set_mode(payload: SystemMode):
    global SYSTEM_MODE
    if payload.mode in ["idle", "generating", "training"]:
        SYSTEM_MODE = payload.mode
    return SystemMode(mode=SYSTEM_MODE)
