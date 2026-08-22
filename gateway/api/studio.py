"""Studio API — mobile workbench backend.

POST /api/v1/studio/requests      multipart(message, image?, preview?) → snapshot
GET  /api/v1/studio/requests      list snapshots
GET  /api/v1/studio/requests/{id} snapshot
GET  /api/v1/studio/events        SSE live feed (initial list + deltas)
GET  /api/v1/studio/push/vapid    VAPID public key
POST /api/v1/studio/push/subscribe {endpoint, keys:{p256dh,auth}}
POST /api/v1/studio/push/test     fire a test notification
"""
import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services import push_service, studio_agent, studio_events as events, studio_store as store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/studio")

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024


@router.post("/requests")
async def create_request(
    message: str = Form(...),
    negative_prompt: str = Form(""),
    preview: bool = Form(False),
    image: UploadFile | None = File(None),
):
    message = message.strip()
    if not message:
        raise HTTPException(400, "message 为空")
    ref_name = ""
    if image and image.filename:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(400, f"不支持的图片类型: {image.content_type}")
        data = await image.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(400, "图片超过 20MB 限制")
        ext = Path(image.filename).suffix.lower().lstrip(".") or "png"
        ref_name = f"{uuid.uuid4().hex[:12]}.{ext}"
        studio_agent.UPLOAD_DIR.mkdir(exist_ok=True)
        (studio_agent.UPLOAD_DIR / ref_name).write_bytes(data)

    req = await store.create_request(message, ref_image=ref_name)
    fields: dict = {}
    if preview:
        fields["detail"] = "[PREVIEW]"
    if negative_prompt.strip():
        fields["params"] = {"negative_prompt": negative_prompt.strip()}
    if fields:
        req = await store.update_request(req["id"], **fields) or req
    asyncio.get_running_loop().create_task(studio_agent.process_request(req["id"]))
    return req


@router.get("/requests")
async def list_requests(limit: int = 50):
    return await store.list_requests(limit)


@router.get("/requests/{request_id}")
async def get_request(request_id: str):
    req = await store.get_request(request_id)
    if not req:
        raise HTTPException(404, "请求不存在")
    return req


@router.get("/events")
async def events_stream():
    from fastapi.responses import StreamingResponse

    q = events.subscribe()

    async def gen():
        try:
            snaps = await store.list_requests()
            yield f"data: {json.dumps({'type': 'snapshot', 'requests': snaps}, ensure_ascii=False)}\n\n"
            while True:
                try:
                    evt = await asyncio.wait_for(q.get(), timeout=25)
                    yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            events.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@router.get("/push/vapid")
async def push_vapid():
    return {"publicKey": push_service.vapid_public_key()}


@router.post("/push/subscribe")
async def push_subscribe(sub: dict):
    endpoint = str(sub.get("endpoint") or "")
    keys = sub.get("keys") or {}
    if not endpoint or not isinstance(keys.get("p256dh"), str) or not isinstance(keys.get("auth"), str):
        raise HTTPException(400, "无效的订阅信息")
    await store.add_subscription(endpoint, keys)
    return {"ok": True}


@router.post("/push/test")
async def push_test():
    n = await push_service.notify_all("ComfyDesk Studio", "这是一条测试通知 ✅")
    return {"delivered": n}
