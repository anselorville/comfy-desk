"""
Prompt Expert Service — conversational image-prompt crafting assistant.

Turns a layperson's rough idea into professional, stable, directly-usable
text-to-image prompts by:
1. Understanding the user's real intent through multi-turn conversation.
2. Matching the request against registered skills (style recipes).
3. Emitting final positive/negative prompt + generation params.

Design notes:
- Reuses the existing llm_adapter (OpenAI-compatible) for the conversational brain.
- Skill knowledge is injected as context so the expert produces prompts
  consistent with ComfyDesk's own workflows and style recipes.
- Falls back to a deterministic skill-matching brain when the LLM is offline,
  so the feature always returns something usable.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from services import llm_adapter
from services import skill_store

logger = logging.getLogger(__name__)

# In-memory conversation store (per-session). Sufficient for a LAN workstation.
_SESSIONS: dict[str, list[dict[str, str]]] = {}
_SESSION_META: dict[str, dict[str, Any]] = {}

MAX_TURNS = 24


def _skill_catalog() -> str:
    lines = []
    for s in skill_store.list_skills():
        if str(s.get("workflow", "")).startswith("image") or "t2i" in s.get("id", ""):
            tags = ",".join(s.get("tags", []))
            lines.append(f"- id={s['id']} name={s.get('name')} desc={s.get('description','')[:80]} tags={tags}")
            # Inject the skill's prompt recipe so the expert can learn each
            # scenario's proven prompt structure, not just its description.
            tpl = (s.get("prompt_template") or "").strip()
            if tpl:
                lines.append(f"  配方结构: {tpl[:600]}")
            neg = (s.get("negative_prompt_template") or "").strip()
            if neg:
                lines.append(f"  负向参考: {neg[:200]}")
    return "\n".join(lines)


def _system_prompt() -> str:
    return (
        "你是 ComfyDesk 的「图像生成提示词专家」(Prompt Expert)。\n"
        "你的任务:帮普通用户把模糊的想法,变成专业、细致、稳定、可直接使用的文生图提示词。\n\n"
        "工作方式:\n"
        "1. 先与用户简短沟通,明确创作意图:主体/场景、风格流派、构图与镜头、光线、色调氛围、画幅比例等。信息不足时提出不超过 2 个最关键的澄清问题。\n"
        "2. 结合下方自有技能风格库,选定或融合一个最贴合的风格方向。\n"
        "3. 当你已经了解足够信息时,输出最终成品。\n\n"
        "输出格式(当你生成最终提示词时,严格输出如下 JSON,不要包裹代码块,不要额外散文):\n"
        "{\n"
        "  \"status\": \"final\",\n"
        "  \"skill_id\": \"融合或选用的技能 id\",\n"
        "  \"positive_prompt\": \"英文正向提示词,包含主体、细节、材质、构图、镜头、光线、色调、画质关键词,用逗号分隔\",\n"
        "  \"negative_prompt\": \"英文负向提示词\",\n"
        "  \"params\": {\"width\": 数字, \"height\": 数字, \"steps\": 数字, \"cfg\": 数字},\n"
        "  \"explanation_zh\": \"用中文简要解释这条提示词的构成逻辑(3-5 句)\",\n"
        "  \"followups_zh\": [\"可继续调整的方向1\", \"方向2\"]\n"
        "}\n\n"
        "当信息还不够时,输出: {\"status\": \"clarify\", \"question_zh\": \"你的澄清问题\", \"intent_zh\": \"你对用户当前需求的理解摘要\"}\n\n"
        "注意:提示词始终用英文书写;负向提示词要覆盖常见缺陷(模糊/畸变/多余手指/水印等);"
        "分辨率需匹配 22GB 显存的稳定范围(短边不超过 1024)。\n\n"
        "自有技能风格库:\n"
        + _skill_catalog()
    )


def _fallback_brain(user_text: str, turn_count: int) -> dict[str, Any]:
    """Deterministic offline brain: keyword-match to a skill and compose a prompt."""
    lower = user_text.lower()
    skills = skill_store.list_skills()
    picked = None
    for s in skills:
        for t in s.get("tags", []):
            if t.lower() in lower or t in user_text:
                picked = s
                break
        if picked:
            break
    if not picked:
        for s in skills:
            if "portrait" in s.get("id", "") or "t2i" in s.get("id", ""):
                picked = s
                break
    if not picked:
        picked = skills[0] if skills else {}

    subject = user_text.strip() or "a beautiful cinematic scene"
    tmpl = picked.get("prompt_template") or "{subject}, cinematic lighting, highly detailed, 8k"
    try:
        positive = tmpl.replace("{subject}", subject)
    except Exception:
        positive = f"{subject}, cinematic lighting, highly detailed, 8k"
    negative = picked.get("negative_prompt_template") or (
        "blurry, low quality, distorted, deformed, bad anatomy, extra fingers, "
        "watermark, text, oversaturated, jpeg artifacts"
    )
    defaults = picked.get("defaults", {}) or {}
    w = int(defaults.get("width", 768))
    h = int(defaults.get("height", 768))
    steps = int(defaults.get("steps", 8))
    cfg = float(defaults.get("cfg", 1.5))

    if turn_count <= 1:
        return {
            "status": "clarify",
            "question_zh": "想把画面做成哪种感觉?例如:人像写真 / 古风水墨 / 像素海报 / 电影大片;有没有想突出的主体、光线或色调?",
            "intent_zh": f"我先确认一下你的创作方向。目前我理解你想生成:「{subject}」",
        }

    return {
        "status": "final",
        "skill_id": picked.get("id", ""),
        "positive_prompt": positive,
        "negative_prompt": negative,
        "params": {"width": w, "height": h, "steps": steps, "cfg": cfg},
        "explanation_zh": (
            f"这条提示词基于技能「{picked.get('name', picked.get('id',''))}」的风格配方生成,"
            f"主体为你描述的内容,并叠加了构图/镜头/光线/画质关键词,使出图更稳定。"
            f"你可以告诉我想调整的方向(比如换成古风、加黄昏光线、改成竖构图),我再迭代。"
        ),
        "followups_zh": ["换一种风格流派", "调整构图与画幅", "增强/减弱光线氛围"],
    }


def _parse_llm_output(content: str | None) -> dict[str, Any] | None:
    if not content:
        return None
    text = content.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and obj.get("status"):
                return obj
        except json.JSONDecodeError:
            pass
    return None


async def expert_reply(session_id: str, user_text: str) -> dict[str, Any]:
    """Main entry: conversational turn -> clarify question OR final prompt."""
    if session_id not in _SESSIONS:
        _SESSIONS[session_id] = []
        _SESSION_META[session_id] = {"turn": 0}
    history = _SESSIONS[session_id]
    meta = _SESSION_META[session_id]
    meta["turn"] = int(meta.get("turn", 0)) + 1

    history.append({"role": "user", "content": user_text})
    messages = [{"role": "system", "content": _system_prompt()}] + history[-MAX_TURNS:]

    result: dict[str, Any] | None = None
    if llm_adapter.configured():
        try:
            out = await llm_adapter.chat_completion(messages, [])
            result = _parse_llm_output(out.get("content"))
        except Exception as e:
            logger.warning("Prompt expert LLM call failed: %s", e)

    if result is None:
        result = _fallback_brain(user_text, int(meta["turn"]))

    history.append({"role": "assistant", "content": json.dumps(result, ensure_ascii=False)})
    if len(history) > MAX_TURNS:
        _SESSIONS[session_id] = history[-MAX_TURNS:]

    result["session_id"] = session_id
    result["turn"] = meta["turn"]
    return result


def reset_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)
    _SESSION_META.pop(session_id, None)


def new_session_id() -> str:
    return uuid.uuid4().hex[:12]
