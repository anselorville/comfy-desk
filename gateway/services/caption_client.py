"""
JoyCaption client — calls the vLLM OpenAI-compatible API.
"""
import base64
import logging
from io import BytesIO

import httpx
from PIL import Image

from config import settings

logger = logging.getLogger(__name__)

_VLLM_BASE = settings.joycaption_url
_MODEL = settings.joycaption_model

# Caption system prompts per style
CAPTION_PROMPTS = {
    "descriptive": (
        "Describe this image in detail using natural language. "
        "Focus on subject, pose, clothing, environment, and lighting."
    ),
    "tags": (
        "Describe this image as a list of comma-separated stable diffusion tags. "
        "Focus on subject, pose, clothing, body details, environment, lighting, and style. "
        "Use lowercase. No complete sentences."
    ),
    "short": "Briefly describe this image in one sentence.",
    "training": (
        "Describe this image using stable diffusion tags. "
        "Focus on subject, pose, clothing, environment, lighting, and style. "
        "Format: tag1, tag2, tag3, ..."
    ),
}


def _encode_image(image_bytes: bytes) -> str:
    """Encode image bytes to base64 data URL."""
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


async def caption_image(
    image_bytes: bytes,
    style: str = "tags",
    max_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """
    Send an image to JoyCaption and return the generated caption.

    Args:
        image_bytes: Raw bytes of the image file.
        style: One of 'descriptive', 'tags', 'short', 'training'.
        max_tokens: Maximum tokens in the caption.
        temperature: Sampling temperature (0 = deterministic).

    Returns:
        Caption string.
    """
    system_prompt = CAPTION_PROMPTS.get(style, CAPTION_PROMPTS["tags"])
    image_url = _encode_image(image_bytes)

    payload = {
        "model": _MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": system_prompt},
                ],
            }
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{_VLLM_BASE}/v1/chat/completions",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
