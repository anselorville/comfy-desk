"""
Prompt Expert API — conversational image-prompt crafting.

POST /api/v1/prompt-expert/chat    — one conversational turn (clarify or final)
POST /api/v1/prompt-expert/reset   — reset a session
GET  /api/v1/prompt-expert/health  — check LLM availability
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import llm_adapter
from services import prompt_expert_service as pes

router = APIRouter()


class ExpertChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's rough idea or reply")
    session_id: str = Field("", description="Conversation session id; blank starts a new one")


class ExpertResetRequest(BaseModel):
    session_id: str = Field(..., description="Session to clear")


@router.post("/prompt-expert/chat")
async def expert_chat(req: ExpertChatRequest):
    """One conversational turn with the prompt expert."""
    try:
        session_id = req.session_id.strip() or pes.new_session_id()
        result = await pes.expert_reply(session_id, req.message)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt expert failed: {e}")


@router.post("/prompt-expert/reset")
async def expert_reset(req: ExpertResetRequest):
    pes.reset_session(req.session_id)
    return {"status": "ok", "session_id": req.session_id}


@router.get("/prompt-expert/health")
async def expert_health():
    return {"llm_configured": llm_adapter.configured()}
