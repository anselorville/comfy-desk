"""
Prompt Expert Service — conversational image-prompt crafting assistant.

Turns a layperson's rough idea into professional, stable, directly-usable
text-to-image prompts by:
1. Understanding the user's real intent through multi-turn conversation.
2. Retrieving relevant examples from the prompt memory (long-term brain)
   and matching registered skills (style recipes).
3. Emitting final positive/negative prompt + generation params.
4. Learning new examples the user teaches it (POST /prompt-expert/learn).

Design notes:
- Reuses the existing llm_adapter (OpenAI-compatible) for the conversational brain.
- Skill catalog + retrieved memory examples are injected as context so the
  expert produces prompts consistent with proven styles, not invented ones.
- Falls back to a deterministic skill-matching brain when the LLM is offline,
  so the feature always returns something usable.
- Conversations stay in-memory (session-scoped); learned knowledge is
  persistent (sqlite via services.prompt_memory).
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from services import llm_adapter
from services import skill_store
from services import prompt_memory

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
    return "\n".join(lines)


def _system_prompt(user_need: str) -> str:
    """System prompt assembled per-turn: method contract + skill ids + retrieved examples."""
    try:
        examples = prompt_memory.search_examples(user_need, top_k=3)
        memory_block = prompt_memory.render_memory_block(examples)
    except Exception as e:
        logger.warning("prompt memory retrieval failed: %s", e)
        memory_block = ""
    return (
        "你是 ComfyDesk 的「图像生成提示词专家」(Prompt Expert)。\n"
        "你的任务:帮普通用户把模糊的想法,变成专业、细致、稳定、可直接使用的文生图提示词。\n\n"
        "工作方式:\n"
        "1. 先与用户简短沟通,明确创作意图:主体/场景、风格流派、构图与镜头、光线、色调氛围、画幅比例等。信息不足时提出不超过 2 个最关键的澄清问题。\n"
        "2. 结合下方技能风格库与已学示例,选定或融合一个最贴合的风格方向。改写时优先模仿已学示例的结构与用词——它们是经过实拍验证的。\n"
        "3. 当你已经了解足够信息时,输出最终成品。\n\n"
        "改写方法论(硬性要求):\n"
        "- 不要只堆砌 quality 形容词;把『自然』『高级』『电影感』翻译成可见的具体选择(材质名/色名/光向/焦段/机位)。\n"
        "- 人数、角色标志物、关键身体特征必须显式锁定,并配对负向排除。\n"
        "- 正向与负向一一对应:写了某个标志物,负向就排除 missing <该标志物>。\n"
        "- 每轮只改一类变量,方便定位问题。\n\n"
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
        "自有技能风格库(选择 skill_id 时参考):\n"
        + _skill_catalog()
        + ("\n\n" + memory_block if memory_block else "")
    )


_LEARN_SYSTEM = (
    "你是提示词知识库的编目员。用户会给你一条优秀的文生图提示词(可能带上下文说明)。"
    "把它拆解为结构化条目,严格输出如下 JSON,不要代码块:\n"
    "{\n"
    "  \"id\": \"小写字母数字连字符slug\",\n"
    "  \"title_zh\": \"简短中文名(8-20字)\",\n"
    "  \"category\": \"guofeng|portrait|cosplay|zine|scene|product|other 之一\",\n"
    "  \"tags\": [\"检索标签5-10个,中英混合,含风格/主体/光线/构图关键词\"],\n"
    "  \"positive\": \"完整正向提示词原文(如果是中文提示词请保留中文,不要翻译)\",\n"
    "  \"negative\": \"负向提示词原文(没有则空串)\",\n"
    "  \"slots\": {\"槽位名\": \"这条提示词在该槽位的写法,提炼为可迁移的公式\"},\n"
    "  \"why_good\": \"这条提示词为什么好,1-3句,提炼可复用的经验\"\n"
    "}\n"
    "slots 是最重要的字段:不要描述这条提示词写了什么,要提炼『这类场景应该怎么写』的公式。\n\n"
    "槽位命名规则(混合式schema):\n"
    "- 优先使用以下规范槽位名(命中哪个用哪个,不必全用): "
    "总述定调 / 主体身份 / 人数锁定 / 姿态动作 / 服装材质 / 场景环境 / "
    "标志性光影 / 镜头构图 / 色彩调色 / 质感细节 / 情绪氛围 / 负向策略 / 交互焦点\n"
    "- 这条提示词独有的、规范词表装不下的方法论,自造槽位名写入(这是允许且鼓励的)。\n"
    "- 同一概念永远用同一个名字(比如光照相关只从『标志性光影』『光语法』中按品类选一个,不要混用近义词)。\n"
    "- 槽位按提示词正文中出现的先后顺序排列。"
)


async def learn_prompt(text: str, source: str = "user-taught") -> dict[str, Any]:
    """Teach the expert a new good prompt: LLM decomposes it, memory stores it."""
    text = (text or "").strip()
    if not text:
        raise ValueError("text is required")
    parsed: dict[str, Any] | None = None
    if llm_adapter.configured():
        try:
            out = await llm_adapter.chat_completion(
                [
                    {"role": "system", "content": _LEARN_SYSTEM},
                    {"role": "user", "content": f"待学习提示词:\n{text}"},
                ],
                [],
            )
            content = (out.get("content") or "").strip()
            content = re.sub(r"^```(?:json)?", "", content).strip()
            content = re.sub(r"```$", "", content).strip()
            m = re.search(r"\{[\s\S]*\}", content)
            if m:
                obj = json.loads(m.group(0))
                if isinstance(obj, dict) and obj.get("positive"):
                    parsed = obj
        except Exception as e:
            logger.warning("prompt learn LLM call failed: %s", e)
    if parsed is None:
        # Offline fallback: store verbatim with crude tags.
        parsed = {
            "id": uuid.uuid4().hex[:10],
            "title_zh": (text[:30] + ("…" if len(text) > 30 else "")),
            "category": "other",
            "tags": [w for w in re.findall(r"[\w\u4e00-\u9fff]{2,6}", text)][:8],
            "positive": text,
            "negative": "",
            "slots": {},
            "why_good": "",
        }
    parsed["source"] = source
    if not str(parsed.get("why_good") or ""):
        parsed["why_good"] = "用户提供的优秀示例"
    saved = prompt_memory.add_example(
        id=str(parsed.get("id") or uuid.uuid4().hex[:10]),
        title_zh=str(parsed.get("title_zh") or "未命名示例"),
        positive=str(parsed["positive"]),
        negative=str(parsed.get("negative") or ""),
        category=str(parsed.get("category") or "other"),
        tags=[str(t) for t in (parsed.get("tags") or [])],
        slots=parsed.get("slots") or {},
        params=parsed.get("params") or {},
        why_good=str(parsed.get("why_good") or ""),
        source=source,
    )
    total = prompt_memory.count_examples()
    return {
        "status": "learned",
        "example_id": saved.get("id"),
        "deduped": saved.get("deduped", False),
        "title_zh": parsed.get("title_zh"),
        "tags": parsed.get("tags"),
        "memory_size": total,
    }


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
    messages = [{"role": "system", "content": _system_prompt(user_text)}] + history[-MAX_TURNS:]

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
