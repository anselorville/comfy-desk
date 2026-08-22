"""OpenAI-compatible chat-completions adapter for the studio agent.

Config (env / .env):
    AGENT_LLM_BASE_URL   e.g. https://api.deepseek.com/v1
    AGENT_LLM_API_KEY    bearer token
    AGENT_LLM_MODEL      e.g. deepseek-chat / glm-4-plus / qwen-max
    AGENT_LLM_MOCK=1     deterministic offline brain for testing the harness

Any OpenAI-compatible provider works (DeepSeek / GLM / DashScope / vLLM / …).
"""
import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(60.0)


def _cfg() -> dict[str, str]:
    return {
        "base_url": os.environ.get("AGENT_LLM_BASE_URL", "").rstrip("/"),
        "api_key": os.environ.get("AGENT_LLM_API_KEY", ""),
        "model": os.environ.get("AGENT_LLM_MODEL", ""),
        "mock": os.environ.get("AGENT_LLM_MOCK", ""),
    }


def configured() -> bool:
    c = _cfg()
    return bool(c["mock"]) or all([c["base_url"], c["api_key"], c["model"]])


async def chat_completion(
    messages: list[dict[str, Any]], tools: list[dict[str, Any]]
) -> dict[str, Any]:
    """Return {'content': str|None, 'tool_calls': [{'name', 'arguments': dict}]}."""
    c = _cfg()
    if c["mock"]:
        return _mock_completion(messages)
    if not all([c["base_url"], c["api_key"], c["model"]]):
        raise RuntimeError(
            "LLM 未配置:请在 .env 设置 AGENT_LLM_BASE_URL / AGENT_LLM_API_KEY / AGENT_LLM_MODEL"
        )

    payload = {
        "model": c["model"],
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{c['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {c['api_key']}"},
            json=payload,
        )
        resp.raise_for_status()
        msg = resp.json()["choices"][0]["message"]

    out: dict[str, Any] = {"content": msg.get("content"), "tool_calls": []}
    for tc in msg.get("tool_calls") or []:
        fn = tc.get("function", {})
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except json.JSONDecodeError:
            args = {}
        out["tool_calls"].append({"name": fn.get("name"), "arguments": args})

    # Fallback: some providers answer plain-JSON content instead of tool calls
    if not out["tool_calls"] and out["content"]:
        try:
            parsed = json.loads(out["content"])
            if isinstance(parsed, dict) and "workflow" in parsed:
                out["tool_calls"].append({"name": "submit_generation", "arguments": parsed})
        except json.JSONDecodeError:
            pass
    return out


# ── offline mock ──────────────────────────────────────────────────────────────

def _mock_completion(messages: list[dict[str, Any]]) -> dict[str, Any]:
    """Heuristic stand-in: image ⇒ I2V character workflow, else T2V."""
    user_msgs = [m for m in messages if m["role"] == "user"]
    text = ""
    for m in reversed(user_msgs):
        text = str(m.get("content") or "")
        break
    has_image = "[参考图已附]" in text or "[REFERENCE IMAGE]" in text
    preview = "[快速预览模式]" in text or "[PREVIEW MODE]" in text
    subject = text.split("[")[0].strip() or "the character moves naturally"
    args: dict[str, Any] = {
        "workflow": "video_wan22_ti2v_5b_i2v" if has_image else "video_wan22_ti2v_5b",
        "prompt": f"{subject}, cinematic lighting, smooth natural motion",
        "negative_prompt": "",
        "steps": 20,
        "cfg": 5,
        "seed": -1,
    }
    if preview:
        args.update({"width": 832, "height": 480, "length": 49})
    else:
        args.update({"width": 1280, "height": 704, "length": 121})
    logger.info("mock brain: %s", args["workflow"])
    return {
        "content": None,
        "tool_calls": [{"name": "submit_generation", "arguments": args}],
    }
