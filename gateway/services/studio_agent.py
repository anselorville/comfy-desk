"""Studio agent — turns a natural-language request (+optional character
reference image) into a queued ComfyUI generation job, tracks it to
completion, publishes live events, and fires Web Push on finish.

Harness shape: single-tool reasoning loop (submit_generation), deterministic
validation/coercion layer, then delegation to the shared generation_runner.
The LLM only decides *what* to generate; execution stays in existing code.
"""
import asyncio
import logging
from pathlib import Path

from services import comfy_client, llm_adapter, studio_events as events, studio_store as store
from services.generation_runner import run_generation_task
from services.task_store import create_task, get_task
from services.workflow_loader import list_workflows

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"


def _system_prompt(has_image: bool, preview: bool, workflows: list[dict]) -> str:
    wf_lines = "\n".join(f"- id={w['id']} name={w.get('name')}" for w in workflows)
    return (
        "你是 ComfyDesk 视频工作室的编排 agent。用户给出自然语言创作需求,"
        "你必须调用工具 submit_generation 提交一个视频生成任务。\n"
        f"可用工作流:\n{wf_lines}\n"
        "规则:\n"
        "1. 附带角色参考图时必须选择 i2v 工作流(以参考图为首帧锚定角色属性);无图则选 t2v 工作流。\n"
        "2. prompt 用英文书写,把用户描述转写为画面与镜头运动描述;保持用户指定的主体不变。\n"
        "3. "
        + ("[快速预览模式] 使用 width=832 height=480 length=49。"
           if preview else "默认 width=1280 height=704 length=121。")
        + "\n4. steps=20 cfg=5 seed=-1,除非用户明确要求其他值。\n"
        "5. 只输出工具调用,不要输出散文。"
    )


def _coerce(args: dict, request_id: str, preview: bool) -> dict:
    wf = str(args.get("workflow") or "")
    if wf not in {"video_wan22_ti2v_5b", "video_wan22_ti2v_5b_i2v"}:
        raise ValueError(f"未知工作流: {wf}")
    prompt = str(args.get("prompt") or "").strip()
    if not prompt:
        raise ValueError("prompt 为空")

    def _int(key: str, lo: int, hi: int, dflt: int) -> int:
        try:
            v = int(float(args.get(key)))
        except (TypeError, ValueError):
            return dflt
        return max(lo, min(hi, v))

    dims = {"width": 832, "height": 480, "length": 49} if preview else {"width": 1280, "height": 704, "length": 121}
    return {
        "workflow": wf,
        "positive_prompt": prompt,
        "negative_prompt": str(args.get("negative_prompt") or ""),
        "steps": _int("steps", 1, 60, 20),
        "cfg": max(1.0, min(15.0, float(args.get("cfg") or 5))),
        **{k: _int(k, lo, hi, dflt) for k, (lo, hi, dflt) in {
            "width": (256, 1280, dims["width"]),
            "height": (256, 720, dims["height"]),
            "length": (5, 241, dims["length"]),
        }.items()},
        "seed": _int("seed", -1, 2**31 - 1, -1),
        "filename_prefix": f"studio_{request_id[:8]}",
    }


async def _publish(request_id: str, **fields) -> dict | None:
    snap = await store.update_request(request_id, **fields)
    if snap:
        events.publish({"type": "request", "request": snap})
    return snap


async def process_request(request_id: str) -> None:
    req = await store.get_request(request_id)
    if not req:
        return
    preview = "[PREVIEW]" in (req.get("detail") or "")
    try:
        if not llm_adapter.configured():
            raise RuntimeError(
                "Agent 大脑未配置:在 .env 设置 AGENT_LLM_BASE_URL/AGENT_LLM_API_KEY/AGENT_LLM_MODEL,"
                "或设 AGENT_LLM_MOCK=1 启用离线模式"
            )

        await _publish(request_id, status=store.RequestStatus.THINKING.value, detail="Agent 分析需求中…")

        # 1) decide
        user_text = req["message"] \
            + ("\n[参考图已附]" if req["ref_image"] else "") \
            + ("\n[快速预览模式]" if preview else "")
        messages = [
            {"role": "system", "content": _system_prompt(bool(req["ref_image"]), preview, list_workflows())},
            {"role": "user", "content": user_text},
        ]
        tools = [{
            "type": "function",
            "function": {
                "name": "submit_generation",
                "description": "提交一个视频生成任务",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "workflow": {"type": "string", "description": "工作流 id"},
                        "prompt": {"type": "string"},
                        "negative_prompt": {"type": "string"},
                        "steps": {"type": "integer"}, "cfg": {"type": "number"},
                        "width": {"type": "integer"}, "height": {"type": "integer"},
                        "length": {"type": "integer"}, "seed": {"type": "integer"},
                    },
                    "required": ["workflow", "prompt"],
                },
            },
        }]
        reply = await llm_adapter.chat_completion(messages, tools)
        if not reply["tool_calls"]:
            raise ValueError(f"Agent 未返回有效决策: {reply['content']!r}")
        params = _coerce(reply["tool_calls"][0]["arguments"], request_id, preview)
        user_negative = (req.get("params") or {}).get("negative_prompt")
        if user_negative:
            params["negative_prompt"] = str(user_negative)
        # 2) reference image → ComfyUI input dir
        if req["ref_image"]:
            image_path = UPLOAD_DIR / req["ref_image"]
            stored = await comfy_client.upload_image(image_path.read_bytes(), image_path.name)
            params["image_filename"] = stored

        # 3) submit through the shared runner
        task = await create_task(kind="generate", prompt=params["positive_prompt"], **params)
        await _publish(
            request_id,
            status=store.RequestStatus.SUBMITTED.value,
            task_id=task.id,
            params=params,
            detail=f"已提交 {params['workflow']} ({params['width']}×{params['height']}, {params['length']} 帧)",
        )
        asyncio.create_task(run_generation_task(task.id, params["workflow"], params))

        # 4) poll to completion
        last_p = -1
        while True:
            await asyncio.sleep(2)
            t = await get_task(task.id)
            if not t:
                continue
            p = t.progress or 0
            if t.status == "running" and p != last_p:
                last_p = p
                await _publish(request_id, status=store.RequestStatus.RUNNING.value,
                               progress=int(p * 0.9), detail=f"引擎生成中 {p}%")
            elif t.status == "done":
                imgs = t.images or []
                first = imgs[0] if imgs else None
                filename = ""
                if isinstance(first, str):
                    filename = first
                elif isinstance(first, dict):
                    filename = first.get("filename", "")
                url = filename if filename.startswith("/") else f"/images/{filename}"
                from services import push_service
                await _publish(request_id, status=store.RequestStatus.DONE.value,
                               progress=100, result_url=url, detail="生成完成")
                await push_service.notify_request_done(request_id, url)
                return
            elif t.status == "failed":
                raise RuntimeError(t.error or "生成任务失败")

    except Exception as exc:
        logger.exception("studio request %s failed", request_id)
        snap = await _publish(request_id, status=store.RequestStatus.FAILED.value,
                              detail=f"{type(exc).__name__}: {exc}"[:500])
        from services import push_service
        if snap:
            await push_service.notify_request_failed(request_id, str(exc)[:120])
