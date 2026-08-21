"""
Skill plugin store — capability encapsulation on top of ComfyUI workflows.

A "skill" is a concretized capability bound to one workflow template:
workflow + scenario metadata + prompt template + parameter defaults.
Skills live as JSON files in gateway/skills/ and are additive plugins:
dropping a file here (or POSTing to /api/v1/skills) registers a capability,
no gateway code changes required.

Skill file schema:
{
  "id": "portrait-studio",              # slug, unique, = filename stem
  "name": "Portrait Studio",            # display name
  "description": "...",                 # what capability this encapsulates
  "workflow": "txt2img_sdxl",           # workflow template id (gateway/workflows/)
  "tags": ["portrait", "photo"],        # scenario tags for discovery
  "prompt_template": "{subject}, ...",  # optional; str.format_map with run params
  "negative_prompt_template": "",       # optional
  "defaults": {"subject": "", ...},     # parameter defaults (sentinel names)
  "fields": ["subject", "steps", ...],  # exposed parameter names for UI forms
  "created_at": "2026-08-22T..."        # set automatically
}
"""
import json
import re
import copy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from services.workflow_loader import WORKFLOW_DIR, load_workflow

SKILL_DIR = Path(__file__).parent.parent / "skills"

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def _skill_path(skill_id: str) -> Path:
    return SKILL_DIR / f"{skill_id}.json"


def _read(path: Path) -> dict[str, Any] | None:
    try:
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def list_skills() -> list[dict[str, Any]]:
    """All registered skills, each enriched with its workflow's field metadata."""
    skills = []
    for p in sorted(SKILL_DIR.glob("*.json")):
        data = _read(p)
        if not data:
            continue
        skills.append(describe_skill(data))
    return skills


def describe_skill(data: dict[str, Any]) -> dict[str, Any]:
    """Join a skill record with its bound workflow metadata."""
    out = dict(data)
    out.setdefault("fields", [])
    out.setdefault("defaults", {})
    out.setdefault("tags", [])
    try:
        meta = load_workflow_meta(data["workflow"])
        out["workflow_meta"] = meta
    except FileNotFoundError:
        out["workflow_meta"] = None
    return out


def load_workflow_meta(workflow_id: str) -> dict[str, Any]:
    meta_path = WORKFLOW_DIR / f"{workflow_id}.meta.json"
    meta = {"id": workflow_id, "name": workflow_id, "fields": []}
    if meta_path.exists():
        data = _read(meta_path)
        if data:
            meta["name"] = data.get("name", workflow_id)
            meta["fields"] = data.get("fields", [])
    return meta


def get_skill(skill_id: str) -> dict[str, Any] | None:
    if not _SLUG_RE.match(skill_id):
        return None
    path = _skill_path(skill_id)
    if not path.exists():
        return None
    data = _read(path)
    return describe_skill(data) if data else None


def skill_exists(skill_id: str) -> bool:
    return _SLUG_RE.match(skill_id) is not None and _skill_path(skill_id).exists()


def validate_skill(spec: dict[str, Any]) -> tuple[str | None, dict[str, Any]]:
    """Validate a skill spec. Returns (error, normalized_spec)."""
    name = (spec.get("name") or "").strip()
    if not name:
        return "field 'name' is required", {}
    workflow = (spec.get("workflow") or "").strip()
    if not workflow:
        return "field 'workflow' is required", {}
    try:
        load_workflow(workflow)
    except FileNotFoundError:
        return f"workflow '{workflow}' does not exist in gateway/workflows/", {}

    skill_id = (spec.get("id") or "").strip() or _slugify(name)
    if not _SLUG_RE.match(skill_id):
        return (
            f"id '{skill_id}' invalid: lowercase letters/digits/-/_ only, "
            "must start alphanumeric, max 64 chars",
            {},
        )

    defaults = spec.get("defaults") or {}
    if not isinstance(defaults, dict):
        return "'defaults' must be an object", {}
    fields = spec.get("fields") or []
    if not isinstance(fields, list) or not all(isinstance(f, str) for f in fields):
        return "'fields' must be a list of parameter names", {}

    normalized = {
        "id": skill_id,
        "name": name,
        "description": str(spec.get("description") or ""),
        "workflow": workflow,
        "tags": [str(t) for t in (spec.get("tags") or [])],
        "prompt_template": str(spec.get("prompt_template") or ""),
        "negative_prompt_template": str(spec.get("negative_prompt_template") or ""),
        "defaults": defaults,
        "fields": fields,
        "created_at": spec.get("created_at")
        or datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    return None, normalized


def save_skill(normalized: dict[str, Any]) -> dict[str, Any]:
    SKILL_DIR.mkdir(parents=True, exist_ok=True)
    path = _skill_path(normalized["id"])
    with open(path, "w") as f:
        json.dump(normalized, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return describe_skill(normalized)


def delete_skill(skill_id: str) -> bool:
    if not _SLUG_RE.match(skill_id):
        return False
    path = _skill_path(skill_id)
    if not path.exists():
        return False
    path.unlink()
    return True


def build_run_params(skill: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    """
    Merge skill defaults with caller overrides and apply prompt templates.

    Returns a flat params dict keyed by workflow sentinel names
    (positive_prompt, negative_prompt, steps, ...). Templates substitute
    {placeholder} tokens from merged values; unresolved tokens stay literal.
    """
    values = copy.deepcopy(skill.get("defaults") or {})
    values.update(overrides or {})

    class _SafeDict(dict):
        def __missing__(self, key: str) -> str:
            return "{" + key + "}"

    def _render(template: str, fallback_key: str) -> str:
        if template:
            return template.format_map(_SafeDict(values))
        return str(values.get(fallback_key, "") or "")

    params = dict(values)
    params["positive_prompt"] = _render(skill.get("prompt_template") or "", "prompt")
    params["negative_prompt"] = _render(
        skill.get("negative_prompt_template") or "", "negative_prompt"
    )
    return params


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:64] or "skill"
