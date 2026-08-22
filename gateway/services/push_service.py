"""Web Push (VAPID) delivery — notifies installed PWAs when jobs finish.

VAPID P-256 keypair is generated once into gateway/vapid_key.json
(gitignored). Delivery runs in a worker thread (pywebpush is synchronous);
dead endpoints (404/410) are pruned automatically.
"""
import asyncio
import base64
import json
import logging
from pathlib import Path

import aiosqlite
from cryptography.hazmat.primitives.asymmetric import ec

from services import studio_store as store

logger = logging.getLogger(__name__)

KEYS_PATH = Path(__file__).parent.parent / "vapid_key.json"


def _load_or_create_keys() -> dict[str, str]:
    if KEYS_PATH.exists():
        return json.loads(KEYS_PATH.read_text())

    from cryptography.hazmat.primitives import serialization

    priv = ec.generate_private_key(ec.SECP256R1())
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    keys = {
        "public": b64(priv.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)),
        "private": b64(priv.private_numbers().private_value.to_bytes(32, "big")),
        "subject": "mailto:studio@comfydesk.local",
    }
    KEYS_PATH.write_text(json.dumps(keys))
    return keys


def vapid_public_key() -> str:
    return _load_or_create_keys()["public"]


async def notify_all(title: str, body: str, url: str = "/m") -> int:
    """Send to every subscription; returns delivered count."""
    subs = await store.list_subscriptions()
    if not subs:
        return 0
    keys = _load_or_create_keys()

    def _send_one(sub: dict) -> bool:
        from pywebpush import WebPushException, webpush
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=keys["private"],
                vapid_claims={"sub": keys["subject"]},
            )
            return True
        except WebPushException as exc:
            code = getattr(getattr(exc, "response", None), "status_code", None)
            if code in (404, 410):
                asyncio.run(_drop(sub["endpoint"]))
            logger.warning("push failed (%s): %s", code, exc)
            return False
        except Exception:
            logger.exception("push error")
            return False

    results = await asyncio.to_thread(lambda: [_send_one(s) for s in subs])
    return sum(results)


async def _drop(endpoint: str) -> None:
    async with aiosqlite.connect(store.DB_PATH) as db:
        await db.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
        await db.commit()


async def notify_request_done(request_id: str, result_url: str) -> None:
    n = await notify_all(
        "🎬 视频已生成完成",
        f"请求 {request_id[:8]} 已完成,点击查看/下载",
        url=f"/m?request={request_id}",
    )
    logger.info("push done-notifications sent: %d", n)


async def notify_request_failed(request_id: str, reason: str) -> None:
    await notify_all(
        "⚠️ 视频生成失败",
        f"请求 {request_id[:8]}: {reason}",
        url=f"/m?request={request_id}",
    )
