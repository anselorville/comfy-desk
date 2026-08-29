"""
GPU Resource Manager & Telemetry
Monitors NVIDIA RTX 2080Ti (22GB VRAM) status and coordinates model offloading / memory reclamation.
"""
import asyncio
import logging
import shutil
import subprocess
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)


def get_gpu_telemetry() -> dict[str, Any]:
    """Query nvidia-smi for current GPU memory, temperature, and utilization."""
    if not shutil.which("nvidia-smi"):
        return {
            "available": False,
            "name": "N/A (CPU / Mock Mode)",
            "total_mb": 0,
            "used_mb": 0,
            "free_mb": 0,
            "utilization_pct": 0,
            "temperature_c": 0,
            "power_w": 0,
        }

    try:
        cmd = [
            "nvidia-smi",
            "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw",
            "--format=csv,noheader,nounits",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            name = parts[0]
            total_mb = int(float(parts[1]))
            used_mb = int(float(parts[2]))
            free_mb = int(float(parts[3]))
            util_pct = int(float(parts[4]))
            temp_c = int(float(parts[5]))
            power_w = float(parts[6]) if len(parts) > 6 else 0.0

            return {
                "available": True,
                "name": name,
                "total_mb": total_mb,
                "used_mb": used_mb,
                "free_mb": free_mb,
                "utilization_pct": util_pct,
                "temperature_c": temp_c,
                "power_w": power_w,
            }
    except Exception as e:
        logger.warning("Failed to query nvidia-smi: %s", e)

    return {
        "available": False,
        "name": "NVIDIA GPU (Telemetry Error)",
        "total_mb": 22528,
        "used_mb": 0,
        "free_mb": 22528,
        "utilization_pct": 0,
        "temperature_c": 0,
        "power_w": 0,
    }


async def free_comfyui_memory() -> bool:
    """Explicitly call ComfyUI /free endpoint to unload models from VRAM."""
    base = settings.comfyui_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{base}/free",
                json={"unload_models": True, "free_memory": True},
            )
            return resp.status_code == 200
    except Exception as e:
        logger.warning("Failed to call ComfyUI /free: %s", e)
        return False
