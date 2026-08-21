"""
Skill plugin API — capability encapsulation over ComfyUI workflows.

GET    /api/v1/skills                 — list registered skills
GET    /api/v1/skills/{skill_id}      — skill detail
POST   /api/v1/skills                 — register (create) a new skill plugin
DELETE /api/v1/skills/{skill_id}      — remove a skill plugin
POST   /api/v1/skills/{skill_id}/run  — execute a skill → generation task
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from services import skill_store
from services.task_store import create_task
from services.generation_runner import run_generation_task
from api.system import get_system_mode

router = APIRouter()


class SkillSpec(BaseModel):
    id: str = Field("", description="Slug id; derived from name when omitted")
    name: str = Field(..., description="Display name")
    description: str = ""
    workflow: str = Field(..., description="Workflow template id in gateway/workflows/")
    tags: list[str] = Field(default_factory=list)
    prompt_template: str = Field(
        "",
        description="Optional {placeholder} template composed with run params; "
        "e.g. '{subject}, cinematic lighting, 35mm'",
    )
    negative_prompt_template: str = ""
    defaults: dict = Field(default_factory=dict, description="Parameter defaults")
    fields: list[str] = Field(default_factory=list, description="Exposed parameter names")


class SkillRunRequest(BaseModel):
    params: dict = Field(default_factory=dict, description="Overrides on top of skill defaults")


@router.get("/skills")
async def list_skills():
    """List all registered capability skills."""
    return {"skills": skill_store.list_skills()}


@router.get("/skills/{skill_id}")
async def get_skill(skill_id: str):
    skill = skill_store.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    return skill


@router.post("/skills", status_code=201)
async def create_skill(spec: SkillSpec):
    """
    Register a new skill plugin from an existing workflow.

    This is the automation seam for building scenario-specific capabilities:
    an external tool (LLM agent, CLI, UI) binds workflow + metadata +
    templates + defaults into a reusable skill. No gateway restart needed.
    """
    err, normalized = skill_store.validate_skill(spec.model_dump())
    if err:
        raise HTTPException(status_code=422, detail=err)
    if skill_store.skill_exists(normalized["id"]):
        raise HTTPException(status_code=409, detail=f"Skill '{normalized['id']}' already exists")
    return skill_store.save_skill(normalized)


@router.delete("/skills/{skill_id}")
async def remove_skill(skill_id: str):
    if not skill_store.delete_skill(skill_id):
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    return {"deleted": skill_id}


@router.post("/skills/{skill_id}/run")
async def run_skill(skill_id: str, request: SkillRunRequest, background_tasks: BackgroundTasks):
    """Execute a skill: defaults ← overrides → prompt templates → ComfyUI task."""
    skill = skill_store.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    if get_system_mode() == "training":
        raise HTTPException(status_code=409, detail="System is occupied by training")

    params = skill_store.build_run_params(skill, request.params)
    task = await create_task(kind="skill", skill=skill_id, workflow=skill["workflow"], **params)
    background_tasks.add_task(run_generation_task, task.id, skill["workflow"], params)
    return {"task_id": task.id, "status": "pending", "skill": skill_id}
