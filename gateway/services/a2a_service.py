"""
A2A (Agent-to-Agent) & Agent Copilot reasoning service.

Provides:
1. Natural language intent understanding (text / image / video / storyboard).
2. Standard tool execution (generate_image, generate_video, create_storyboard, get_system_status, gpu_cleanup).
3. MCP (Model Context Protocol) tool schema definitions.
"""
import asyncio
import uuid
from typing import Any

from services.task_store import create_task
from services.generation_runner import run_generation_task
from services.director_service import plan_storyboard
from services.gpu_manager import get_gpu_telemetry, free_comfyui_memory
from services import gpu_watchdog


A2A_TOOLS = [
    {
        "name": "generate_image",
        "description": "Generate high-resolution photorealistic, anime, pixel art, or stylised images via local ComfyUI GPU workflows.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Detailed text prompt describing visual elements, lighting, camera and scene.",
                },
                "negative_prompt": {
                    "type": "string",
                    "description": "Negative keywords to avoid (e.g. blurry, deformed, bad anatomy).",
                },
                "style": {
                    "type": "string",
                    "enum": ["photorealistic", "pixel_art", "anime", "cyberpunk", "3d_render"],
                    "description": "Visual style preset.",
                },
                "aspect_ratio": {
                    "type": "string",
                    "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
                    "description": "Output aspect ratio (default: 1:1).",
                },
                "steps": {"type": "integer", "description": "Inference steps (default: 8 for Turbo)."},
                "seed": {"type": "integer", "description": "Random seed (-1 for random)."},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "generate_video",
        "description": "Generate 5-second cinematic AI video clips with camera motion and native audio using MiniMax H3 or Wan2.1.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Text prompt describing scene motion, action, lighting and mood.",
                },
                "model": {
                    "type": "string",
                    "enum": ["minimax_h3", "wan22_5b"],
                    "description": "Video model backend (default: minimax_h3).",
                },
                "aspect_ratio": {
                    "type": "string",
                    "enum": ["16:9", "9:16", "1:1"],
                    "description": "Video aspect ratio (default: 16:9).",
                },
                "camera_movement": {
                    "type": "string",
                    "enum": ["dolly_in", "dolly_out", "pan_left", "pan_right", "orbit_360", "crane_up", "static"],
                    "description": "Cinematic camera movement choreography.",
                },
                "reference_image": {
                    "type": "string",
                    "description": "Optional image filename or URL for first-frame image-to-video anchoring.",
                },
                "preview": {
                    "type": "boolean",
                    "description": "Render fast 480P preview instead of 768P.",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "create_storyboard",
        "description": "Deconstruct a narrative story script into a multi-shot cinematic storyboard sequence with camera motions and shot tags.",
        "parameters": {
            "type": "object",
            "properties": {
                "synopsis": {"type": "string", "description": "Story outline or screenplay summary."},
                "style": {"type": "string", "description": "Visual style preset (e.g. cinematic, anime, cyberpunk)."},
                "num_shots": {"type": "integer", "description": "Number of shots to generate (3-6)."},
                "aspect_ratio": {"type": "string", "description": "Aspect ratio for the shots (16:9, 9:16)."},
            },
            "required": ["synopsis"],
        },
    },
    {
        "name": "get_system_status",
        "description": "Fetch real-time GPU telemetry (RTX 2080Ti VRAM usage, temperature, power) and engine state.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "gpu_cleanup",
        "description": "Flush resident models from VRAM and free GPU memory for model switching.",
        "parameters": {"type": "object", "properties": {}},
    },
]


def _dimension_for_aspect(aspect: str, is_video: bool = False, model: str = "minimax_h3") -> tuple[int, int]:
    if is_video:
        if model == "minimax_h3":
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
            "seconds": 5.0,
            "fps": 24.0,
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
    lower_msg = message.lower()

    # Determine intent strictly based on mode, or infer if auto
    if mode == "storyboard":
        is_storyboard, is_video, is_image = True, False, False
    elif mode == "video":
        is_storyboard, is_video, is_image = False, True, False
    elif mode == "image":
        is_storyboard, is_video, is_image = False, False, True
    else:
        # mode == "auto" -> intelligent keyword inference
        is_storyboard = "分镜" in lower_msg or "storyboard" in lower_msg or ("剧本" in lower_msg and "镜头" in lower_msg)
        is_video = (
            not is_storyboard
            and (
                "视频" in lower_msg
                or "video" in lower_msg
                or "动起来" in lower_msg
                or "运镜" in lower_msg
                or "生成5秒" in lower_msg
                or (bool(ref_image) and ("让" in lower_msg or "镜头" in lower_msg))
            )
            and ("生成图片" not in lower_msg and "画一张" not in lower_msg and "画幅" not in lower_msg or "视频" in lower_msg)
        )
        is_image = not is_storyboard and not is_video

    # 1. Storyboard Branch
    if is_storyboard:
        sb = await plan_storyboard(message, style="cinematic", num_shots=3, aspect_ratio=aspect_ratio)
        return {
            "reply": f"🎬 导演已为您构思了包含 {len(sb['shots'])} 个镜头的分镜计划：\n" + "\n".join([f"• **{s['title']}** ({s['shot_type']}): {s['scene_description']}" for s in sb['shots']]),
            "kind": "storyboard",
            "storyboard": sb,
            "status": "planned",
        }

    # 2. Video Branch
    if is_video:
        is_i2v = bool(ref_image)
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
            "seconds": 5.0,
            "fps": 24.0,
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

    # 3. Image Generation Branch
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
