"""
Artifact collection API — the desk shell's platform artifact index.

GET /api/v1/artifacts — recent completed/failed tasks with their outputs
(images, workflow, skill, params, timestamps). This is the single feed the
frontend gallery and external tooling consume to collect everything the
platform has produced.

DELETE /api/v1/artifacts — delete selected artifact files and corresponding task records.
"""
from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from config import settings
from services.task_store import list_tasks, get_task, update_task, delete_tasks, delete_task, TaskStatus

router = APIRouter()

_VALID_STATUSES = {s.value for s in TaskStatus}
_MEDIA_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".gif"}


class DeleteArtifactsRequest(BaseModel):
    ids: list[str] = []
    filenames: list[str] = []


def _get_output_dirs() -> list[Path]:
    repo_root = Path(__file__).parent.parent.parent
    dirs = [
        repo_root / "comfy-ui" / "output",
        repo_root / "outputs",
        repo_root / "volumes" / "output",
    ]
    if settings.output_dir:
        dirs.append(Path(settings.output_dir))
    return [d for d in dirs if d.exists() and d.is_dir()]


def _artifact_view(task) -> dict:
    params = task.params or {}
    return {
        "id": task.id,
        "status": task.status.value,
        "created_at": task.created_at,
        "images": task.images,
        "error": task.error,
        "kind": params.get("kind", "generate"),
        "skill": params.get("skill"),
        "workflow": params.get("workflow"),
        "prompt": params.get("prompt") or params.get("positive_prompt") or "",
        "params": {k: v for k, v in params.items() if k not in {"kind"}},
    }


@router.get("/artifacts")
async def get_artifacts(
    status: str = Query("done", description="done | failed | running | pending | all"),
    limit: int = Query(100, ge=1, le=500),
    skill: str = Query("", description="Filter by skill id"),
    workflow: str = Query("", description="Filter by workflow id"),
):
    if status not in _VALID_STATUSES | {"all"}:
        raise HTTPException(status_code=422, detail=f"status must be one of {_VALID_STATUSES | {'all'}}")

    tasks = await list_tasks(status=None if status == "all" else status, limit=limit * 4)
    artifacts = [_artifact_view(t) for t in tasks]

    # Collect all image filenames already referenced in existing task artifacts
    known_files = set()
    for art in artifacts:
        for img in art["images"]:
            known_files.add(img)

    # Scan output directories for any unindexed files or files missing from tasks
    disk_artifacts = []
    seen_disk_filenames = set()

    for out_dir in _get_output_dirs():
        try:
            for entry in os.scandir(out_dir):
                if entry.is_file() and not entry.name.startswith("."):
                    ext = Path(entry.name).suffix.lower()
                    if ext in _MEDIA_EXTS:
                        fn = entry.name
                        if fn in seen_disk_filenames:
                            continue
                        seen_disk_filenames.add(fn)

                        # If not already present in artifacts, check if it matches a task prefix or add standalone
                        if fn not in known_files:
                            mtime = os.path.getmtime(entry.path)
                            created_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(timespec="seconds")
                            is_video = ext in {".mp4", ".webm"}
                            
                            # Check if matches any task's filename_prefix
                            matched_task = None
                            for t in tasks:
                                prefix = (t.params or {}).get("filename_prefix")
                                if prefix and fn.startswith(prefix):
                                    matched_task = t
                                    break
                            
                            if matched_task:
                                if fn not in matched_task.images:
                                    matched_task.images.append(fn)
                                    known_files.add(fn)
                                    # Async backfill task in DB
                                    try:
                                        await update_task(matched_task.id, images=matched_task.images)
                                    except Exception:
                                        pass
                            else:
                                disk_artifacts.append({
                                    "id": f"file_{fn}",
                                    "status": "done",
                                    "created_at": created_iso,
                                    "images": [fn],
                                    "error": None,
                                    "kind": "video" if is_video else "image",
                                    "skill": None,
                                    "workflow": "ComfyUI Output",
                                    "prompt": fn.rsplit(".", 1)[0].replace("_", " "),
                                    "params": {},
                                })
        except Exception:
            pass

    # Filter task artifacts with images or add all
    if status == "done":
        artifacts = [a for a in artifacts if a["images"]]

    all_artifacts = artifacts + disk_artifacts

    if skill:
        all_artifacts = [a for a in all_artifacts if a["skill"] == skill]
    if workflow:
        all_artifacts = [a for a in all_artifacts if a["workflow"] == workflow]

    # Sort descending by created_at
    all_artifacts.sort(key=lambda a: a.get("created_at") or "", reverse=True)

    return {"artifacts": all_artifacts[:limit], "output_dir": settings.output_dir}


@router.delete("/artifacts")
@router.post("/artifacts/delete")
async def delete_artifacts(
    req: Optional[DeleteArtifactsRequest] = None,
    id: Optional[str] = Query(None),
    filename: Optional[str] = Query(None),
):
    """Delete artifact files from disk and remove or update task records."""
    target_ids = list(req.ids) if req and req.ids else []
    target_filenames = list(req.filenames) if req and req.filenames else []

    if id and id not in target_ids:
        target_ids.append(id)
    if filename and filename not in target_filenames:
        target_filenames.append(filename)

    if not target_ids and not target_filenames:
        raise HTTPException(status_code=400, detail="Must provide at least one id or filename to delete")

    deleted_files = []
    output_dirs = _get_output_dirs()

    # 1. Resolve filenames from task IDs if needed
    for tid in target_ids:
        if tid.startswith("file_"):
            fn = tid[5:]
            if fn not in target_filenames:
                target_filenames.append(fn)
        else:
            task = await get_task(tid)
            if task and task.images:
                for img in task.images:
                    if img not in target_filenames:
                        target_filenames.append(img)
            # Delete task record
            await delete_task(tid)

    # 2. Delete physical files
    for fn in target_filenames:
        clean_fn = Path(fn).name
        for out_dir in output_dirs:
            file_path = out_dir / clean_fn
            if file_path.exists() and file_path.is_file():
                try:
                    file_path.unlink()
                    deleted_files.append(clean_fn)
                except Exception as e:
                    pass

    # 3. Clean up any remaining task references in DB
    all_tasks = await list_tasks(limit=500)
    for t in all_tasks:
        if t.images:
            new_imgs = [img for img in t.images if img not in target_filenames]
            if len(new_imgs) != len(t.images):
                if new_imgs:
                    await update_task(t.id, images=new_imgs)
                else:
                    await delete_task(t.id)

    return {
        "success": True,
        "deleted_count": len(deleted_files),
        "deleted_files": deleted_files,
        "deleted_ids": target_ids,
    }

