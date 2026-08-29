"""
Agent-to-Agent (A2A) Service
Provides an intelligent mediation layer for external AI agents (Gemini CLI, DeepSeek Harness, Claude Code, etc.)
and natural language user chat.
"""
import asyncio
import json
import logging
import uuid
from typing import Any

from config import settings
from services import comfy_client, gpu_watchdog, llm_adapter
from services.task_store import create_task, get_task, TaskStatus
from services.generation_runner import run_generation_task
from services.gpu_manager import get_gpu_telemetry, free_comfyui_memory
from services.director_service import plan_storyboard

logger = logging.getLogger(__name__)

# Standard OpenAPI / OpenAI / Gemini tool declarations
A2A_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": "Generate high quality images using ComfyUI with fast Turbo inference or styled LoRAs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Visual scene description in English or Chinese"},
                    "style": {
                        "type": "string",
                        "enum": ["photorealistic", "anime", "cyberpunk", "pixel_art", "3d_render"],
                        "description": "Visual styling preset",
                        "default": "photorealistic",
                    },
                    "aspect_ratio": {
                        "type": "string",
                        "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
                        "default": "1:1",
                    },
                    "negative_prompt": {"type": "string", "default": ""},
                    "steps": {"type": "integer", "default": 8, "description": "Inference steps (8 for Turbo, 20 for standard)"},
                    "seed": {"type": "integer", "default": -1},
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_video",
            "description": "Generate cinematic AI video with camera motion and audio using MiniMax H3 or Wan2.1.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Scene and motion description with camera directives"},
                    "model": {
                        "type": "string",
                        "enum": ["minimax_h3", "wan2.1"],
                        "default": "minimax_h3",
                        "description": "Video model engine (MiniMax H3 includes native stereo audio)",
                    },
                    "camera_movement": {
                        "type": "string",
                        "enum": ["dolly_in", "dolly_out", "pan_left", "pan_right", "orbit_360", "crane_up", "static_focus", "dynamic_action"],
                        "default": "dolly_in",
                    },
                    "aspect_ratio": {
                        "type": "string",
                        "enum": ["16:9", "9:16", "1:1"],
                        "default": "16:9",
                    },
                    "reference_image": {
                        "type": "string",
                        "description": "Optional starting image URL or filename for Image-to-Video generation",
                    },
                    "preview": {"type": "boolean", "default": False, "description": "Fast preview mode (480P)"},
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_storyboard",
            "description": "Deconstruct a narrative story or script into a multi-shot cinematic video storyboard.",
            "parameters": {
                "type": "object",
                "properties": {
                    "synopsis": {"type": "string", "description": "Story outline or script"},
                    "num_shots": {"type": "integer", "default": 3, "description": "Number of consecutive shots"},
                    "style": {"type": "string", "default": "cinematic"},
                    "aspect_ratio": {"type": "string", "default": "16:9"},
                },
                "required": ["synopsis"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_status",
            "description": "Query GPU memory (22GB VRAM), active model, temperature, and queue status.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gpu_cleanup",
            "description": "Unload resident ComfyUI models and free VRAM before launching heavy video tasks.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _dimension_for_aspect(aspect: str, is_video: bool, model: str = "") -> tuple[int, int]:
    if is_video:
        if "minimax" in model:
            return {"16:9": (1344, 768), "9:16": (768, 1344), "1:1": (1024, 1024)}.get(aspect, (1344, 768))
        else:
            return {"16:9": (1280, 704), "9:16": (704, 1280), "1:1": (1024, 1024)}.get(aspect, (1280, 704))
    else:
        return {
            "1:1": (1024, 1024),
            "16:9": (1280, 720),
            "9:16": (720, 1280),
            "4:3": (1024, 768),
            "3:4": (768, 1024),
        }.get(aspect, (1024, 1024))


async def execute_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Execute a tool invoked by an external agent."""
    gpu_watchdog.touch()
    
    if name == "get_system_status":
        telemetry = get_gpu_telemetry()
        return {"status": "ok", "gpu": telemetry}

    elif name == "gpu_cleanup":
        success = await free_comfyui_memory()
        telemetry = get_gpu_telemetry()
        return {"status": "ok", "success": success, "gpu": telemetry}

    elif name == "create_storyboard":
        synopsis = str(args.get("synopsis") or "")
        style = str(args.get("style") or "cinematic")
        num_shots = int(args.get("num_shots") or 3)
        aspect = str(args.get("aspect_ratio") or "16:9")
        sb = await plan_storyboard(synopsis, style=style, num_shots=num_shots, aspect_ratio=aspect)
        return {"status": "planned", "storyboard": sb}

    elif name == "generate_image":
        prompt = str(args.get("prompt") or "").strip()
        style = str(args.get("style") or "photorealistic")
        aspect = str(args.get("aspect_ratio") or "1:1")
        steps = int(args.get("steps") or 8)
        seed = int(args.get("seed") or -1)
        neg = str(args.get("negative_prompt") or "")

        wf = "image_z_image_pixel" if style == "pixel_art" else "image_z_image_turbo"
        w, h = _dimension_for_aspect(aspect, is_video=False)

        params = {
            "workflow": wf,
            "positive_prompt": prompt,
            "negative_prompt": neg,
            "steps": steps,
            "cfg": 1.5 if wf == "image_z_image_turbo" else 7.0,
            "width": w,
            "height": h,
            "seed": seed,
            "filename_prefix": f"a2a_{uuid.uuid4().hex[:8]}",
        }
        task = await create_task(kind="generate", **params)
        asyncio.create_task(run_generation_task(task.id, wf, params))
        return {
            "status": "submitted",
            "task_id": task.id,
            "workflow": wf,
            "stream_url": f"/api/v1/tasks/{task.id}/stream",
            "poll_url": f"/api/v1/tasks/{task.id}",
        }

    elif name == "generate_video":
        prompt = str(args.get("prompt") or "").strip()
        model = str(args.get("model") or "minimax_h3")
        aspect = str(args.get("aspect_ratio") or "16:9")
        ref_img = str(args.get("reference_image") or "").strip()
        preview = bool(args.get("preview", False))
        cam = str(args.get("camera_movement") or "")

        if cam:
            prompt = f"{prompt}, [Camera: {cam}]"

        is_i2v = bool(ref_img)
        if model == "minimax_h3":
            wf = "video_minimax_h3_i2v" if is_i2v else "video_minimax_h3_t2v"
        else:
            wf = "video_wan22_ti2v_5b_i2v" if is_i2v else "video_wan22_ti2v_5b"

        w, h = _dimension_for_aspect(aspect, is_video=True, model=model)
        if preview:
            w, h = (832, 480)

        params = {
            "workflow": wf,
            "positive_prompt": prompt,
            "negative_prompt": str(args.get("negative_prompt") or ""),
            "steps": 12 if preview else 20,
            "cfg": 5.0,
            "width": w,
            "height": h,
            "seed": -1,
            "length": 49 if preview else 121,
            "filename_prefix": f"a2a_video_{uuid.uuid4().hex[:8]}",
        }
        if is_i2v:
            params["image_filename"] = ref_img.split("/")[-1]

        task = await create_task(kind="generate_video", **params)
        asyncio.create_task(run_generation_task(task.id, wf, params))
        return {
            "status": "submitted",
            "task_id": task.id,
            "workflow": wf,
            "model": model,
            "stream_url": f"/api/v1/tasks/{task.id}/stream",
            "poll_url": f"/api/v1/tasks/{task.id}",
        }

    raise ValueError(f"Unknown tool: {name}")


async def handle_agent_chat(
    message: str,
    ref_image: str = "",
    mode: str = "auto",
    aspect_ratio: str = "16:9",
    preview: bool = False,
) -> dict[str, Any]:
    """Conversational reasoning endpoint for Agent Copilot & A2A interaction."""
    gpu_watchdog.touch()
    
    # 1. Check if user wants a storyboard
    lower_msg = message.lower()
    is_storyboard = mode == "storyboard" or ("分镜" in lower_msg or "storyboard" in lower_msg or "镜头" in lower_msg and ("连续" in lower_msg or "剧本" in lower_msg))
    
    if is_storyboard:
        sb = await plan_storyboard(message, style="cinematic", num_shots=3, aspect_ratio=aspect_ratio)
        return {
            "reply": f"🎬 导演已为您构思了包含 {len(sb['shots'])} 个镜头的分镜计划：\n" + "\n".join([f"• **{s['title']}** ({s['shot_type']}): {s['scene_description']}" for s in sb['shots']]),
            "kind": "storyboard",
            "storyboard": sb,
            "status": "planned",
        }

    # 2. Check if user wants video
    is_video = mode == "video" or (
        "视频" in lower_msg or "video" in lower_msg or "动起来" in lower_msg or "运镜" in lower_msg or "生成5秒" in lower_msg or "动画" in lower_msg
    )

    if is_video:
        is_i2v = bool(ref_image)
        # Select MiniMax H3 or Wan2.1
        wf = "video_minimax_h3_i2v" if is_i2v else "video_minimax_h3_t2v"
        w, h = _dimension_for_aspect(aspect_ratio, is_video=True, model="minimax_h3")
        if preview:
            w, h = (832, 480)

        params = {
            "workflow": wf,
            "positive_prompt": f"cinematic video, {message}, master lighting, photorealistic, 4k",
            "negative_prompt": "blurry, low quality, distorted, deformed",
            "steps": 12 if preview else 20,
            "cfg": 5.0,
            "width": w,
            "height": h,
            "seed": -1,
            "length": 49 if preview else 121,
            "filename_prefix": f"copilot_video_{uuid.uuid4().hex[:8]}",
        }
        if is_i2v:
            params["image_filename"] = ref_image.split("/")[-1]

        task = await create_task(kind="generate_video", **params)
        asyncio.create_task(run_generation_task(task.id, wf, params))
        
        return {
            "reply": f"🎬 已调动 MiniMax H3 视频生成引擎（含原生立体声配音），正在为您渲染 {aspect_ratio} 规格的视频...",
            "kind": "video",
            "task_id": task.id,
            "workflow": wf,
            "status": "running",
            "poll_url": f"/api/v1/tasks/{task.id}",
            "stream_url": f"/api/v1/tasks/{task.id}/stream",
        }

    # 3. Default to fast image generation
    is_pixel = "像素" in lower_msg or "pixel" in lower_msg
    wf = "image_z_image_pixel" if is_pixel else "image_z_image_turbo"
    w, h = _dimension_for_aspect(aspect_ratio, is_video=False)

    params = {
        "workflow": wf,
        "positive_prompt": f"masterpiece, best quality, 8k, cinematic, {message}",
        "negative_prompt": "blurry, low quality, distorted, deformed, bad anatomy",
        "steps": 8,
        "cfg": 1.5,
        "width": w,
        "height": h,
        "seed": -1,
        "filename_prefix": f"copilot_img_{uuid.uuid4().hex[:8]}",
    }
    task = await create_task(kind="generate", **params)
    asyncio.create_task(run_generation_task(task.id, wf, params))

    return {
        "reply": f"✨ 已调动 ComfyUI Turbo 极速图像引擎，正在为您生成「{message[:25]}...」作品...",
        "kind": "image",
        "task_id": task.id,
        "workflow": wf,
        "status": "running",
        "poll_url": f"/api/v1/tasks/{task.id}",
        "stream_url": f"/api/v1/tasks/{task.id}/stream",
    }
