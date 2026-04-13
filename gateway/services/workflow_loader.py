"""
Workflow template loader and parameter injector.

Workflows are stored as JSON files in the gateway/workflows/ directory.
Each JSON is a valid ComfyUI API-format workflow.
Parameter injection replaces sentinel values (e.g. __POSITIVE_PROMPT__).
"""
import json
import copy
from pathlib import Path
from typing import Any

WORKFLOW_DIR = Path(__file__).parent.parent / "workflows"


def list_workflows() -> list[dict[str, Any]]:
    workflows = []
    for p in WORKFLOW_DIR.glob("*.json"):
        if p.name.endswith(".meta.json"):
            continue
        wf_id = p.stem
        meta_path = WORKFLOW_DIR / f"{wf_id}.meta.json"
        
        meta = {"id": wf_id, "name": wf_id, "fields": []}
        if meta_path.exists():
            with open(meta_path) as mf:
                try:
                    meta_data = json.load(mf)
                    meta["name"] = meta_data.get("name", wf_id)
                    meta["fields"] = meta_data.get("fields", [])
                except Exception:
                    pass
        workflows.append(meta)
    return workflows


def load_workflow(name: str) -> dict[str, Any]:
    path = WORKFLOW_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Workflow '{name}' not found")
    with open(path) as f:
        return json.load(f)


def inject_params(workflow: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    """
    Deep-clone the workflow and replace sentinel string values with params.

    Sentinel format: "__KEY__" → params["key"]
    e.g. "__POSITIVE_PROMPT__" → params["positive_prompt"]
    """
    wf = copy.deepcopy(workflow)
    _replace_sentinels(wf, params)
    return wf


def _replace_sentinels(obj: Any, params: dict[str, Any]) -> Any:
    if isinstance(obj, dict):
        for k, v in obj.items():
            obj[k] = _replace_sentinels(v, params)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            obj[i] = _replace_sentinels(v, params)
    elif isinstance(obj, str) and obj.startswith("__") and obj.endswith("__"):
        key = obj[2:-2].lower()
        if key in params:
            return params[key]
    return obj
