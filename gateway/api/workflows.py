"""
Workflow template API.

GET    /api/v1/workflows        — list available workflow templates
GET    /api/v1/workflows/{name} — raw workflow JSON
POST   /api/v1/workflows        — register a new ComfyUI API-format workflow
DELETE /api/v1/workflows/{name} — remove a workflow template

POST is the automation seam for capability building: an external tool
(LLM agent, importer) generates a ComfyUI API-format graph from a natural
language requirement and registers it here; it becomes immediately usable
by /api/v1/generate and as a skill binding target.
"""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.workflow_loader import (
    list_workflows,
    load_workflow,
    workflow_exists,
    save_workflow,
    delete_workflow,
)

router = APIRouter()

_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


class WorkflowRegistration(BaseModel):
    name: str = Field(..., description="Template id slug: [a-zA-Z0-9_-]{1,64}")
    title: str = Field("", description="Human-readable display name")
    workflow: dict = Field(..., description="ComfyUI API-format node graph")
    fields: list[dict] = Field(
        default_factory=list,
        description=(
            "Parameter metadata for UI form rendering: "
            '[{"name": "...", "type": "...", "label": "...", "default": ...}]'
        ),
    )


@router.get("/workflows")
async def get_workflows():
    """List all available ComfyUI workflow templates."""
    return {"workflows": list_workflows()}


@router.get("/workflows/{name}")
async def get_workflow(name: str):
    """Return the raw workflow JSON for a given template name."""
    try:
        wf = load_workflow(name)
        return wf
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Workflow '{name}' not found")


@router.post("/workflows", status_code=201)
async def register_workflow(reg: WorkflowRegistration):
    """
    Register a new workflow template (ComfyUI API format).

    Writes gateway/workflows/{name}.json plus a .meta.json sidecar so the
    template is immediately listable, executable, and skill-bindable.
    """
    if not _NAME_RE.match(reg.name):
        raise HTTPException(
            status_code=422,
            detail="name must match [a-zA-Z0-9_-]{1,64}",
        )
    if not isinstance(reg.workflow, dict) or not reg.workflow:
        raise HTTPException(status_code=422, detail="workflow must be a non-empty node graph")
    if workflow_exists(reg.name):
        raise HTTPException(status_code=409, detail=f"Workflow '{reg.name}' already exists")

    meta = {"id": reg.name, "name": reg.title or reg.name, "fields": reg.fields}
    save_workflow(reg.name, reg.workflow, meta)
    return {"id": reg.name, "name": meta["name"], "fields": reg.fields}


@router.delete("/workflows/{name}")
async def remove_workflow(name: str):
    if not delete_workflow(name):
        raise HTTPException(status_code=404, detail=f"Workflow '{name}' not found")
    return {"deleted": name}
