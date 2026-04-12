"""
GET /api/v1/workflows — list available workflow templates
"""
from fastapi import APIRouter, HTTPException

from services.workflow_loader import list_workflows, load_workflow

router = APIRouter()


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
