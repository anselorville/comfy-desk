"""
Prompt Expert API — conversational image-prompt crafting + persistent learning.

POST /api/v1/prompt-expert/chat    — one conversational turn (clarify or final)
POST /api/v1/prompt-expert/learn   — teach the expert a new good prompt (persistent)
GET  /api/v1/prompt-expert/memory  — list learned examples
GET  /api/v1/prompt-expert/memory/{id}
DEL  /api/v1/prompt-expert/memory/{id}
POST /api/v1/prompt-expert/reset   — reset a chat session
GET  /api/v1/prompt-expert/health  — check LLM availability + memory size
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import llm_adapter
from services import prompt_expert_service as pes
from services import prompt_memory

router = APIRouter()


class ExpertChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's rough idea or reply")
    session_id: str = Field("", description="Conversation session id; blank starts a new one")


class ExpertLearnRequest(BaseModel):
    text: str = Field(..., min_length=1, description="A good text-to-image prompt to learn from")
    source: str = Field("user-taught", description="Provenance label for the example")


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


@router.post("/prompt-expert/learn")
async def expert_learn(req: ExpertLearnRequest):
    """Teach the expert a new good prompt — decomposed and stored persistently."""
    try:
        return await pes.learn_prompt(req.text, req.source)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt expert learn failed: {e}")


@router.get("/prompt-expert/memory")
async def expert_memory_list(limit: int = 200):
    """All learned examples (most recent first)."""
    return {"count": prompt_memory.count_examples(), "examples": prompt_memory.list_examples(limit)}


@router.get("/prompt-expert/memory/{example_id}")
async def expert_memory_get(example_id: str):
    ex = prompt_memory.get_example(example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="example not found")
    return ex


@router.delete("/prompt-expert/memory/{example_id}")
async def expert_memory_delete(example_id: str):
    if not prompt_memory.delete_example(example_id):
        raise HTTPException(status_code=404, detail="example not found")
    return {"status": "ok", "deleted": example_id}


@router.post("/prompt-expert/reset")
async def expert_reset(req: ExpertResetRequest):
    pes.reset_session(req.session_id)
    return {"status": "ok", "session_id": req.session_id}


@router.get("/prompt-expert/health")
async def expert_health():
    return {
        "llm_configured": llm_adapter.configured(),
        "memory_size": prompt_memory.count_examples(),
    }
