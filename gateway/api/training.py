import sys
import asyncio
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from api.system import get_system_mode, set_system_mode
from collections import deque

router = APIRouter()

# Simple global string queue for training logs, capturing stdout
TRAINING_LOGS: deque[str] = deque(maxlen=2000)
TRAINING_PROCESS: asyncio.subprocess.Process | None = None

class TrainRequest(BaseModel):
    epoch_limit: int = 10
    learning_rate: float = 1e-4

@router.post("/training/start")
async def start_training(req: TrainRequest):
    global TRAINING_PROCESS, TRAINING_LOGS
    if get_system_mode() == "generating":
        raise HTTPException(status_code=409, detail="System is busy generating")
    if get_system_mode() == "training" or (TRAINING_PROCESS and TRAINING_PROCESS.returncode is None):
        raise HTTPException(status_code=409, detail="Training already running")

    # Change mode
    set_system_mode("training")
    TRAINING_LOGS.clear()
    TRAINING_LOGS.append("[SYSTEM] Starting Kohya_ss LoRA Subprocess...")
    
    # In a real environment, we'd spawn bash training/launch_lora.sh with args.
    # For simulation, we run a python one-liner or bash script
    try:
        TRAINING_PROCESS = await asyncio.create_subprocess_exec(
            "bash",
            "training/launch_lora.sh",
             "--epoch", str(req.epoch_limit),
             "--lr", str(req.learning_rate),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        
        # Start a background task to consume stdout into the ring buffer
        async def _log_consumer(proc: asyncio.subprocess.Process):
            while True:
                line = await proc.stdout.readline()  # type: ignore[union-attr]
                if not line:
                    break
                TRAINING_LOGS.append(line.decode("utf-8").strip())
            await proc.wait()
            set_system_mode("idle")
            TRAINING_LOGS.append(f"[SYSTEM] Process Exited with {proc.returncode}")
        
        asyncio.create_task(_log_consumer(TRAINING_PROCESS))
    except Exception as e:
        TRAINING_LOGS.append(f"[ERROR] Failed to start subprocess: {e}")
        set_system_mode("idle")
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "started"}

@router.get("/training/logs")
async def stream_training_logs():
    async def event_generator():
        last_index = 0
        while True:
            # Yield any new lines
            current_len = len(TRAINING_LOGS)
            if current_len > last_index:
                for i in range(last_index, current_len):
                    yield {"event": "log", "data": TRAINING_LOGS[i]}
                last_index = current_len
            
            # If process has exited and we've yielded everything, stop
            if TRAINING_PROCESS and TRAINING_PROCESS.returncode is not None:
                if last_index >= len(TRAINING_LOGS):
                    break
                    
            await asyncio.sleep(0.5)
            
    return EventSourceResponse(event_generator())
