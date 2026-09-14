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
from services.prompt_stylist import enhance_travel_prompt, CINEMATOGRAPHY_PRESETS
from services import gpu_watchdog


A2A_TOOLS = [
    {
        "name": "retouch_photo",
        "description": "Transform amateur travel snapshots, poor-lighting portraits, or cluttered photos into professional cinematography masterpieces (Leica, Hasselblad, Kodak Portra, Golden Hour) using AI relighting and camera prompt synthesis.",
        "parameters": {
            "type": "object",
            "properties": {
                "image_filename": {
                    "type": "string",
                    "description": "Uploaded reference photo filename (e.g. upload_xxx.jpg or user photo).",
                },
                "prompt": {
                    "type": "string",
                    "description": "Amateur natural language description of desired aesthetic, scene, or edits.",
                },
                "style": {
                    "type": "string",
                    "enum": ["film_portra", "golden_hour", "fuji_clean", "cyber_night", "natgeo_epic"],
                    "description": "Cinematography visual preset.",
                },
                "remove_passersby": {
                    "type": "boolean",
                    "description": "Whether to clean tourists and clutter in background (default: true).",
                },
                "denoise": {
                    "type": "number",
                    "description": "Restyling strength (0.45 - 0.75, default: 0.62).",
                },
            },
            "required": ["image_filename"],
        },
    },
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

    elif name == "retouch_photo":
        ref_img = str(args.get("image_filename") or "").strip()
        user_prompt = str(args.get("prompt") or "").strip()
        style = str(args.get("style") or "film_portra")
        remove_passersby = bool(args.get("remove_passersby", True))
        denoise = float(args.get("denoise") or 0.62)

        enhanced = enhance_travel_prompt(user_prompt, style_id=style, remove_passersby=remove_passersby)
        wf = "photo_cinematic_retouch"
        img_fn = ref_img if ref_img.startswith("data:") else ref_img.split("?")[0].split("/")[-1]
        params = {
            "workflow": wf,
            "image_filename": img_fn,
            "positive_prompt": enhanced["positive_prompt"],
            "negative_prompt": enhanced["negative_prompt"],
            "steps": 12,
            "cfg": 1.5,
            "denoise": denoise,
            "seed": -1,
            "filename_prefix": f"copilot_retouch_{uuid.uuid4().hex[:8]}",
        }
        task = await create_task(kind="retouch_photo", **params)
        asyncio.create_task(run_generation_task(task.id, wf, params))
        return {
            "status": "submitted",
            "task_id": task.id,
            "workflow": wf,
            "style": enhanced["style_label"],
            "summary_zh": enhanced["summary_zh"],
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
        is_storyboard, is_video, is_retouch, is_image = True, False, False, False
    elif mode == "video":
        is_storyboard, is_video, is_retouch, is_image = False, True, False, False
    elif mode == "retouch":
        is_storyboard, is_video, is_retouch, is_image = False, False, True, False
    elif mode == "image":
        is_storyboard, is_video, is_retouch, is_image = False, False, False, True
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
                or (bool(ref_image) and ("让" in lower_msg and "动" in lower_msg))
            )
            and ("生成图片" not in lower_msg and "画一张" not in lower_msg and "画幅" not in lower_msg or "视频" in lower_msg)
        )
        is_retouch = (
            not is_storyboard
            and not is_video
            and bool(ref_image)
            and any(kw in lower_msg for kw in ["修", "改", "大片", "胶片", "旅行", "拍照", "光线", "路人", "优化", "重塑", "质感", "摄影", "调色", "背景", "滤镜"])
        )
        is_image = not is_storyboard and not is_video and not is_retouch

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

        img_fn = ref_image if ref_image.startswith("data:") else ref_image.split("?")[0].split("/")[-1]
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
            params["image_filename"] = img_fn

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

    # 3. Photo Retouching Branch (Travel & Cinematography Master)
    if is_retouch:
        # Intelligently classify across full 23 travel scenarios
        style_key = "landmark_crowd_clean"
        if any(w in lower_msg for w in ["舷窗", "飞机", "云海", "机窗"]):
            style_key = "transit_plane_window"
        elif any(w in lower_msg for w in ["高铁", "列车", "火车", "车厢"]):
            style_key = "transit_train_speed"
        elif any(w in lower_msg for w in ["自驾", "公路", "敞篷"]):
            style_key = "transit_road_trip"
        elif any(w in lower_msg for w in ["夜市", "路边摊", "蒸汽", "美食", "排挡"]):
            style_key = "street_food_steam"
        elif any(w in lower_msg for w in ["咖啡", "下午茶", "露天", "法式"]):
            style_key = "cozy_cafe_afternoon"
        elif any(w in lower_msg for w in ["居酒屋", "红灯笼", "小巷", "微醺"]):
            style_key = "izakaya_lantern"
        elif any(w in lower_msg for w in ["雨夜", "积水", "倒影", "赛博"]):
            style_key = "cyber_rain_reflections"
        elif any(w in lower_msg for w in ["天台", "高空", "天际线", "俯瞰夜景"]):
            style_key = "rooftop_skyline_night"
        elif any(w in lower_msg for w in ["森林", "晨雾", "丁达尔", "树林", "绿意"]):
            style_key = "nature_misty_forest"
        elif any(w in lower_msg for w in ["雪山", "高原", "金顶", "日照金山"]):
            style_key = "nature_snow_mountain"
        elif any(w in lower_msg for w in ["海岛", "玻璃海", "沙滩", "椰林"]):
            style_key = "nature_tropical_island"
        elif any(w in lower_msg for w in ["阴天", "死白", "大平光", "重打光"]):
            style_key = "rescue_overcast_flat"
        elif any(w in lower_msg for w in ["逆光", "黑脸", "暗沉", "眼神光"]):
            style_key = "rescue_backlit_dark_face"
        elif any(w in lower_msg for w in ["闪光灯", "直闪", "油光", "红眼"]):
            style_key = "rescue_harsh_flash"
        elif any(w in lower_msg for w in ["断崖", "悬崖", "海平线"]):
            style_key = "sunset_cliff_epic"
        elif any(w in lower_msg for w in ["蓝调", "blue hour", "暮色", "清冷"]):
            style_key = "blue_hour_twilight"
        elif any(w in lower_msg for w in ["落日", "夕阳", "发丝", "海边日落", "黄金时刻"]):
            style_key = "sunset_beach_rim"
        elif any(w in lower_msg for w in ["宫殿", "教堂", "穹顶", "纵深", "史诗"]):
            style_key = "landmark_epic_scale"
        elif any(w in lower_msg for w in ["地标夜景", "泛光", "辉煌"]):
            style_key = "landmark_night_lit"
        elif any(w in lower_msg for w in ["富士", "velvia", "色彩"]):
            style_key = "film_fuji_velvia"
        elif any(w in lower_msg for w in ["cinestill", "800t", "红晕"]):
            style_key = "film_cinestill_800t"
        elif any(w in lower_msg for w in ["徕卡", "leica", "portra", "胶片"]):
            style_key = "film_leica_portra"

        remove_passersby = ("不去除路人" not in lower_msg and "保留路人" not in lower_msg)
        add_golden_light = any(w in lower_msg for w in ["黄金", "金光", "侧逆光", "暖阳", "金晕"])
        shallow_bokeh = any(w in lower_msg for w in ["虚化", "景深", "大光圈", "散景"]) or True
        sculpt_face = any(w in lower_msg for w in ["面部", "五官", "微光", "质感", "肤色"]) or True

        enhanced = enhance_travel_prompt(
            message,
            style_id=style_key,
            remove_passersby=remove_passersby,
            add_golden_light=add_golden_light,
            shallow_bokeh=shallow_bokeh,
            sculpt_face=sculpt_face,
        )
        wf = "photo_cinematic_retouch"

        img_fn = ref_image if ref_image.startswith("data:") else ref_image.split("?")[0].split("/")[-1]
        params = {
            "workflow": wf,
            "image_filename": img_fn,
            "positive_prompt": enhanced["positive_prompt"],
            "negative_prompt": enhanced["negative_prompt"],
            "steps": 12,
            "cfg": 1.5,
            "denoise": enhanced["denoise"],
            "seed": -1,
            "filename_prefix": f"copilot_retouch_{uuid.uuid4().hex[:8]}",
        }
        task = await create_task(kind="retouch_photo", **params)
        asyncio.create_task(run_generation_task(task.id, wf, params))

        return {
            "reply": f"📸 **AI 摄影大师已为您启动大片重塑计划！**\n\n{enhanced['summary_zh']}\n\n⚡ 正在调动 ComfyUI 摄影级图生图引擎为您深度渲染...",
            "kind": "image",
            "task_id": task.id,
            "workflow": wf,
            "status": "running",
            "poll_url": f"/api/v1/tasks/{task.id}",
            "stream_url": f"/api/v1/tasks/{task.id}/stream",
        }

    # 4. Standard Text-to-Image Generation Branch
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
