# Phase 3: Training Pipeline - Research

## Overview
Phase 3 integrates local model training into the ComfyDesk environment by wrapping `kohya_ss`. Before training, a user must prepare a dataset containing images and captions. ComfyDesk will use JoyCaption through vLLM to auto-caption the images and provide a text editor interface. Finally, training will be triggered as a background subprocess, streaming logs to the UI.

## Technical Decisions
1. **Dataset Viewing & Editing**: We need to read images from the `DATASET_DIR`. We'll expose `GET /api/v1/dataset/images` (paginated) and `GET /api/v1/dataset/images/{id}` alongside their matching `.txt` files. Editing a caption triggers a file save action in the Gateway.
2. **Auto-Captioning Integration**: JoyCaption runs on `vLLM` container at port `8000`. The gateway calls it via Async HTTP client (`services/caption_client.py`), passing the image and system prompt. Batching this action across multiple images should be asynchronous tasks trackable in the UI.
3. **Training Trigger (kohya_ss)**: Since kohya_ss relies on `.sh` scripts, the Gateway will execute the script using `asyncio.create_subprocess_exec` (`training/launch_lora.sh`). 
4. **Log Streaming**: The stdout and stderr of the training subprocess will be fed into an SSE stream (`/api/v1/training/logs`), enabling the NextJS UI to show a "terminal-style" live running text block. Output models (`.safetensors`) from the training script will be surfaced in a dedicated model view.

## Validation Strategy
- Upload or mock dataset images. Call the JoyCaption batch API and ensure `.txt` files appear alongside images.
- Modify a caption using the `PUT` API endpoint.
- Kick off a fake/test training script (a simple script that echoes numbers with delays). Subscribe to the SSE log endpoint and ensure logs arrive chronologically.
