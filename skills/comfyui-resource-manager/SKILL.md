---
name: comfyui-resource-manager
description: |
  Hardware resource scheduler and VRAM optimization skill for NVIDIA RTX 2080Ti (22GB VRAM).
  Prevents OOM, manages model unloading, and optimizes batch sizes.
triggers:
  - "gpu"
  - "vram"
  - "显存"
  - "资源调度"
  - "oom"
  - "cuda memory"
---

# ComfyUI Resource Manager (22GB VRAM Profile)

## Hardware Profile
- **GPU**: NVIDIA GeForce RTX 2080Ti (Modified 22,528 MiB VRAM).
- **Architecture**: Turing (SM 7.5, compute 7.5).
- **Driver**: 535.309.01 | CUDA 12.2.
- **Attention Backend**: Use standard `pytorch` attention on Turing (avoid kernels requiring newer SM80+).

## VRAM Allocation Matrix
| Model Type | Quantization / Format | Active VRAM | Safe Concurrency |
|---|---|---|---|
| Z-Image Turbo | BF16 / FP16 | ~4.5 GB | Coexists with JoyCaption |
| MiniMax H3 Video | INT8 DiT + Qwen3-VL GGUF | ~16 GB | Exclusive (Unload other heavy models) |
| Wan2.1 5B Video | FP16 Ti2V + UMT5 Scaled | ~14 GB | Exclusive |
| JoyCaption vLLM | AWQ / BF16 | ~8 GB | Can stay resident during image gen |

## Scheduling Rules
1. **Mutual Exclusion for Video**: Before launching MiniMax H3 or Wan2.1, notify gateway to free idle cached weights.
2. **Preview Mode vs Full Render**:
   - Preview: 832x480 resolution, 8-15 steps (takes ~15-25s).
   - High-Res: 1344x768 or 1280x704, 20 steps (takes ~45-70s).
3. **VRAM Health Endpoint**:
   Check `GET /api/v1/system/gpu` or trigger cleanup with `POST /api/v1/system/gpu-cleanup`.
