"""
Workflow template loader and parameter injector.

Workflows are stored as JSON files in the gateway/workflows/ directory.
Each JSON is a valid ComfyUI API-format workflow.
Parameter injection replaces sentinel values (e.g. __POSITIVE_PROMPT__).
"""
import json
import copy
import random
import re
from pathlib import Path
from typing import Any

WORKFLOW_DIR = Path(__file__).parent.parent / "workflows"

DEFAULT_SENTINEL_VALUES: dict[str, Any] = {
    "positive_prompt": "",
    "negative_prompt": "",
    "steps": 20,
    "cfg": 5.0,
    "width": 1024,
    "height": 1024,
    "length": 121,
    "seconds": 5.0,
    "fps": 24.0,
    "filename_prefix": "comfydesk_out",
    "lora_strength": 1.0,
    "image_filename": "",
}


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


def workflow_exists(name: str) -> bool:
    return _valid_name(name) and (WORKFLOW_DIR / f"{name}.json").exists()


def save_workflow(name: str, workflow: dict[str, Any], meta: dict[str, Any] | None = None) -> None:
    """
    Register a ComfyUI API-format workflow template.

    Automation seam: external tools (LLM agents, importers) push generated
    workflows here instead of hand-editing files.
    """
    if not _valid_name(name):
        raise ValueError("Workflow name must match [a-zA-Z0-9_-]{1,64}")
    WORKFLOW_DIR.mkdir(parents=True, exist_ok=True)
    with open(WORKFLOW_DIR / f"{name}.json", "w") as f:
        json.dump(workflow, f, indent=2, ensure_ascii=False)
        f.write("\n")
    if meta is not None:
        with open(WORKFLOW_DIR / f"{name}.meta.json", "w") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
            f.write("\n")


def delete_workflow(name: str) -> bool:
    if not workflow_exists(name):
        return False
    (WORKFLOW_DIR / f"{name}.json").unlink()
    (WORKFLOW_DIR / f"{name}.meta.json").unlink(missing_ok=True)
    return True


def _valid_name(name: str) -> bool:
    return bool(re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", name))


def inject_params(workflow: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    """
    Deep-clone the workflow and replace sentinel string values with params.

    Sentinel format: "__KEY__" → params["key"]
    e.g. "__POSITIVE_PROMPT__" → params["positive_prompt"]
    """
    # Normalize params keys to lowercase
    norm_params = {k.lower(): v for k, v in params.items()}

    # Resolve seed: if -1 or not given, assign random positive int
    if "seed" not in norm_params or norm_params["seed"] is None or norm_params["seed"] == -1:
        norm_params["seed"] = random.randint(1, 2**32 - 1)
    else:
        try:
            norm_params["seed"] = int(norm_params["seed"])
            if norm_params["seed"] < 0:
                norm_params["seed"] = random.randint(1, 2**32 - 1)
        except (ValueError, TypeError):
            norm_params["seed"] = random.randint(1, 2**32 - 1)

    # Resolve seconds default if missing
    if "seconds" not in norm_params:
        norm_params["seconds"] = 5.0
    else:
        try:
            norm_params["seconds"] = float(norm_params["seconds"])
        except (ValueError, TypeError):
            norm_params["seconds"] = 5.0

    wf = copy.deepcopy(workflow)
    _replace_sentinels(wf, norm_params)
    return wf


def _cast_sentinel_value(key: str, val: Any) -> Any:
    """Ensure sentinel values conform to the expected types in ComfyUI schemas."""
    if key in ("seed", "steps", "width", "height", "length"):
        try:
            return int(val)
        except (ValueError, TypeError):
            return val
    elif key in ("cfg", "seconds", "fps", "lora_strength"):
        try:
            return float(val)
        except (ValueError, TypeError):
            return val
    return val


def _replace_sentinels(obj: Any, params: dict[str, Any]) -> Any:
    if isinstance(obj, dict):
        for k, v in obj.items():
            obj[k] = _replace_sentinels(v, params)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            obj[i] = _replace_sentinels(v, params)
    elif isinstance(obj, str) and obj.startswith("__") and obj.endswith("__"):
        key = obj[2:-2].lower()
        if key in params and params[key] is not None:
            return _cast_sentinel_value(key, params[key])
        elif key in DEFAULT_SENTINEL_VALUES:
            return _cast_sentinel_value(key, DEFAULT_SENTINEL_VALUES[key])
    return obj
