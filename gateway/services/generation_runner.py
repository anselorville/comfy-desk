"""
Shared generation task runner.

Executes a workflow template against a params dict (sentinel names:
positive_prompt, negative_prompt, steps, cfg, width, height, seed,
lora, lora_strength, filename_prefix, image_filename) and tracks progress in the task store.
Used by both POST /api/v1/generate and the skill run endpoints.
"""
import asyncio
import uuid
import logging

from services import comfy_client, gpu_watchdog
from services.task_store import update_task, TaskStatus
from services.workflow_loader import load_workflow, inject_params

logger = logging.getLogger(__name__)


async def run_generation_task(task_id: str, workflow_name: str, params: dict) -> None:
    gpu_watchdog.touch()
    client_id = str(uuid.uuid4())
    try:
        await update_task(task_id, status=TaskStatus.RUNNING, progress=10)

        # Random seed when unset/negative
        seed = params.get("seed")
        if not isinstance(seed, int) or seed < 0:
            seed = int(uuid.uuid4().int % 2**32)
        params = {**params, "seed": seed}

        # If workflow expects an image_filename (I2V / Inpaint / Ref), ensure file exists in ComfyUI input/
        if params.get("image_filename"):
            clean_fn = await comfy_client.ensure_image_in_input(params["image_filename"])
            if clean_fn:
                params["image_filename"] = clean_fn

        wf = load_workflow(workflow_name)
        wf = inject_params(wf, params)

        await update_task(task_id, progress=20)

        prompt_id = await comfy_client.queue_prompt(wf, client_id)
        await update_task(task_id, progress=30)

        images = await comfy_client.wait_for_completion(prompt_id, client_id, task_id)
        await update_task(task_id, status=TaskStatus.DONE, progress=100, images=images)

    except Exception as exc:
        logger.exception("Generation task %s failed", task_id)
        await update_task(task_id, status=TaskStatus.FAILED, error=str(exc))
