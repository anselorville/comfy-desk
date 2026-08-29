"""
Director & Storyboard Service
Handles cinematic multi-shot decomposition, shot continuity planning, camera direction, and generation.
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from config import settings
from services import comfy_client, gpu_watchdog, llm_adapter
from services.task_store import create_task, update_task, TaskStatus
from services.generation_runner import run_generation_task

logger = logging.getLogger(__name__)
DB_PATH = Path(__file__).parent.parent / "studio.db"

CAMERA_MOVEMENTS = [
    {"id": "dolly_in", "label": "推进镜头 (Dolly In)", "prompt_tag": "[Camera: Slow Cinematic Dolly In, moving closer to subject]"},
    {"id": "dolly_out", "label": "拉远镜头 (Dolly Out)", "prompt_tag": "[Camera: Slow Dolly Out, revealing wider surrounding environment]"},
    {"id": "pan_left", "label": "左移镜头 (Pan Left)", "prompt_tag": "[Camera: Smooth Horizontal Pan Left, tracking environment]"},
    {"id": "pan_right", "label": "右移镜头 (Pan Right)", "prompt_tag": "[Camera: Smooth Horizontal Pan Right, tracking scene motion]"},
    {"id": "orbit_360", "label": "环绕运镜 (Orbit / Arc)", "prompt_tag": "[Camera: Dramatic 360-degree Arc Orbit around the subject]"},
    {"id": "crane_up", "label": "升降镜头 (Crane / Jib Up)", "prompt_tag": "[Camera: Smooth Crane Upwards, elevated majestic viewpoint]"},
    {"id": "static_focus", "label": "静止特写 (Static Close-up)", "prompt_tag": "[Camera: Static fixed camera, intense emotional close-up with micro details]"},
    {"id": "dynamic_action", "label": "动感跟随 (Dynamic Tracking)", "prompt_tag": "[Camera: Fast dynamic handheld tracking shot, high energy action]"},
]

STYLE_PRESETS = [
    {"id": "cinematic", "label": "🎬 电影级写实 (Cinematic 8K)", "prompt_prefix": "cinematic still, 35mm photograph, master composition, volumetric light, photorealistic, 8k"},
    {"id": "anime", "label": "🌸 新海诚动画 (Anime Aesthetic)", "prompt_prefix": "anime visual masterpiece, Makoto Shinkai style, vibrant sky, expressive lighting, clean lineart"},
    {"id": "cyberpunk", "label": "🌆 赛博朋克 (Cyberpunk Neon)", "prompt_prefix": "cyberpunk neo-city aesthetics, neon lights, rain reflections, volumetric fog, futuristic technology"},
    {"id": "pixel_art", "label": "👾 复古像素 (Pixel Art Retro)", "prompt_prefix": "masterpiece pixel art, 16-bit color depth, sharp pixels, isometric perspective, game scene"},
    {"id": "3d_render", "label": "🎨 3D皮克斯风 (Pixar 3D Render)", "prompt_prefix": "Pixar 3D animation style, octane render, rich subsurface scattering, warm cinematic lighting"},
]


async def init_director_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS storyboards (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                synopsis TEXT NOT NULL,
                style TEXT DEFAULT 'cinematic',
                aspect_ratio TEXT DEFAULT '16:9',
                status TEXT DEFAULT 'draft',
                shots_json TEXT DEFAULT '[]',
                created_at TEXT DEFAULT '',
                updated_at TEXT DEFAULT ''
            )
        ''')
        await db.commit()


async def plan_storyboard(synopsis: str, style: str = "cinematic", num_shots: int = 3, aspect_ratio: str = "16:9") -> dict[str, Any]:
    """Use Agent LLM (or smart fallback) to decompose synopsis into cinematic multi-shot script."""
    await init_director_db()
    storyboard_id = f"sb_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    
    style_info = next((s for s in STYLE_PRESETS if s["id"] == style), STYLE_PRESETS[0])

    shots = []
    title = synopsis[:20] if len(synopsis) <= 20 else synopsis[:18] + "..."

    # Check if LLM is configured
    if llm_adapter.configured() and not settings.agent_llm_mock:
        try:
            system_prompt = (
                "You are an expert film director and AI video cinematographer.\n"
                f"Deconstruct the user's story into exactly {num_shots} cinematic video shots.\n"
                "Return ONLY a valid JSON array of shot objects with no markdown wrapping or explanations.\n"
                "Each shot object MUST have:\n"
                "- shot_number (int): 1, 2, 3...\n"
                "- title (string): short title in Chinese\n"
                "- shot_type (string): e.g. '全景空镜 (Wide)', '中景动作 (Medium)', '特写高潮 (Close-up)'\n"
                "- camera_movement (string): pick from 'dolly_in', 'dolly_out', 'pan_left', 'pan_right', 'orbit_360', 'crane_up', 'static_focus', 'dynamic_action'\n"
                "- scene_description (string): descriptive scene explanation in Chinese\n"
                "- prompt (string): ultra-detailed English visual prompt for video generation incorporating style and camera movement\n"
                "- duration_sec (int): 5\n"
                "- engine (string): 'video_minimax_h3_t2v' for shot 1, 'video_minimax_h3_i2v' for subsequent continuous shots\n"
            )
            user_prompt = f"Story Synopsis: {synopsis}\nVisual Style: {style_info['label']}\nAspect Ratio: {aspect_ratio}\nTotal Shots: {num_shots}"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            resp = await llm_adapter.chat_completion(messages, tools=[])
            content = (resp.get("content") or "").strip()
            
            # Remove possible ```json ... ``` code blocks
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()
                
            parsed_shots = json.loads(content)
            if isinstance(parsed_shots, list) and len(parsed_shots) > 0:
                for idx, s in enumerate(parsed_shots):
                    shot_cam = s.get("camera_movement", CAMERA_MOVEMENTS[idx % len(CAMERA_MOVEMENTS)]["id"])
                    cam_tag = next((c["prompt_tag"] for c in CAMERA_MOVEMENTS if c["id"] == shot_cam), "")
                    p = s.get("prompt", "")
                    if cam_tag and cam_tag not in p:
                        p = f"{p}, {cam_tag}"
                    
                    shots.append({
                        "id": f"{storyboard_id}_shot_{idx+1}",
                        "shot_number": idx + 1,
                        "title": s.get("title", f"镜头 {idx+1}"),
                        "shot_type": s.get("shot_type", "标准镜头"),
                        "camera_movement": shot_cam,
                        "scene_description": s.get("scene_description", ""),
                        "prompt": p,
                        "negative_prompt": "blurry, low quality, distorted, deformed, artifacts, noisy",
                        "engine": s.get("engine", "video_minimax_h3_t2v" if idx == 0 else "video_minimax_h3_i2v"),
                        "status": "pending",
                        "progress": 0,
                        "keyframe_url": "",
                        "video_url": "",
                        "task_id": "",
                        "duration_sec": s.get("duration_sec", 5),
                    })
        except Exception as e:
            logger.warning("LLM storyboard planning failed, falling back to heuristic director: %s", e)
            shots = []

    # Heuristic fallback if LLM returned nothing or failed
    if not shots:
        shot_types = ["全景建立 (Wide Establishing)", "中景展开 (Medium Narrative)", "特写高潮 (Dramatic Close-up)", "环境收尾 (Outro Landscape)"]
        
        for i in range(num_shots):
            cam = CAMERA_MOVEMENTS[i % len(CAMERA_MOVEMENTS)]
            stype = shot_types[i % len(shot_types)]
            shots.append({
                "id": f"{storyboard_id}_shot_{i+1}",
                "shot_number": i + 1,
                "title": f"镜头 {i+1}：{stype.split(' ')[0]}",
                "shot_type": stype,
                "camera_movement": cam["id"],
                "scene_description": f"画面第 {i+1} 段：{synopsis}，采用{cam['label']}运镜展现细节。",
                "prompt": f"{style_info['prompt_prefix']}, cinematic shot {i+1} of {synopsis}, {cam['prompt_tag']}, master lighting, photorealistic textures",
                "negative_prompt": "blurry, low quality, distorted, deformed, artifacts",
                "engine": "video_minimax_h3_t2v" if i == 0 else "video_minimax_h3_i2v",
                "status": "pending",
                "progress": 0,
                "keyframe_url": "",
                "video_url": "",
                "task_id": "",
                "duration_sec": 5,
            })

    sb_record = {
        "id": storyboard_id,
        "title": title,
        "synopsis": synopsis,
        "style": style,
        "aspect_ratio": aspect_ratio,
        "status": "planned",
        "shots": shots,
        "created_at": now,
        "updated_at": now,
    }

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO storyboards (id, title, synopsis, style, aspect_ratio, status, shots_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sb_record["id"], sb_record["title"], sb_record["synopsis"], sb_record["style"],
             sb_record["aspect_ratio"], sb_record["status"], json.dumps(sb_record["shots"], ensure_ascii=False),
             sb_record["created_at"], sb_record["updated_at"]),
        )
        await db.commit()

    return sb_record


async def get_storyboard(sb_id: str) -> dict[str, Any] | None:
    await init_director_db()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM storyboards WHERE id = ?", (sb_id,)) as cursor:
            row = await cursor.fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["shots"] = json.loads(d.get("shots_json") or "[]")
    except json.JSONDecodeError:
        d["shots"] = []
    d.pop("shots_json", None)
    return d


async def list_storyboards(limit: int = 50) -> list[dict[str, Any]]:
    await init_director_db()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM storyboards ORDER BY created_at DESC LIMIT ?", (limit,)) as cursor:
            rows = await cursor.fetchall()
    res = []
    for r in rows:
        d = dict(r)
        try:
            d["shots"] = json.loads(d.get("shots_json") or "[]")
        except json.JSONDecodeError:
            d["shots"] = []
        d.pop("shots_json", None)
        res.append(d)
    return res


async def update_shot_in_storyboard(sb_id: str, shot_id: str, **fields: Any) -> dict[str, Any] | None:
    await init_director_db()
    sb = await get_storyboard(sb_id)
    if not sb:
        return None
    shots = sb["shots"]
    for s in shots:
        if s["id"] == shot_id:
            s.update(fields)
            break
            
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE storyboards SET shots_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(shots, ensure_ascii=False), now, sb_id),
        )
        await db.commit()
    sb["shots"] = shots
    sb["updated_at"] = now
    return sb


async def render_storyboard_shot(sb_id: str, shot_id: str, preview: bool = False) -> dict[str, Any]:
    """Execute generation for a specific shot in a storyboard."""
    sb = await get_storyboard(sb_id)
    if not sb:
        raise ValueError(f"Storyboard not found: {sb_id}")
    shot = next((s for s in sb["shots"] if s["id"] == shot_id), None)
    if not shot:
        raise ValueError(f"Shot not found: {shot_id}")

    gpu_watchdog.touch()
    wf_name = shot.get("engine", "video_minimax_h3_t2v")
    aspect = sb.get("aspect_ratio", "16:9")
    
    # Map aspect ratio to standard resolution
    dims = {
        "16:9": (1344, 768) if "minimax" in wf_name else (1280, 704),
        "9:16": (768, 1344) if "minimax" in wf_name else (704, 1280),
        "1:1": (1024, 1024),
        "4:3": (1024, 768),
    }.get(aspect, (1280, 720))
    
    if preview:
        dims = (832, 480)

    # Set parameters
    params = {
        "workflow": wf_name,
        "positive_prompt": shot["prompt"],
        "negative_prompt": shot.get("negative_prompt", ""),
        "steps": 12 if preview else 20,
        "cfg": 5.0,
        "width": dims[0],
        "height": dims[1],
        "seed": -1,
        "length": 49 if preview else 121,
        "filename_prefix": f"director_{shot_id[:12]}",
    }
    
    # Handle reference image / keyframe if I2V
    if "i2v" in wf_name and shot.get("keyframe_url"):
        params["image_filename"] = shot["keyframe_url"].split("/")[-1]

    task = await create_task(kind="director_shot", **params)
    await update_shot_in_storyboard(sb_id, shot_id, status="rendering", task_id=task.id, progress=5)

    # Launch task in background
    asyncio.create_task(_run_shot_task(sb_id, shot_id, task.id, wf_name, params))
    return {"task_id": task.id, "status": "rendering", "shot_id": shot_id}


async def _run_shot_task(sb_id: str, shot_id: str, task_id: str, wf_name: str, params: dict) -> None:
    try:
        await run_generation_task(task_id, wf_name, params)
        # Fetch output image/video from task
        from services.task_store import get_task
        task = await get_task(task_id)
        if task and task.status == TaskStatus.DONE and task.images:
            media_url = f"/images/{task.images[0]}"
            await update_shot_in_storyboard(sb_id, shot_id, status="done", progress=100, video_url=media_url)
        elif task and task.status == TaskStatus.FAILED:
            await update_shot_in_storyboard(sb_id, shot_id, status="failed", error=task.error or "Generation failed")
    except Exception as e:
        logger.exception("Shot %s task failed: %s", shot_id, e)
        await update_shot_in_storyboard(sb_id, shot_id, status="failed", error=str(e))
