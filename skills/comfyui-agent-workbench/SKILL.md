---
name: comfyui-agent-workbench
description: |
  Master skill for AI Agents to programmatically command ComfyUI and ComfyDesk.
  Supports generating photorealistic images, stylizations, and AI video (Wan2.1 / MiniMax H3)
  with zero manual node wiring.
triggers:
  - "comfyui"
  - "画图"
  - "文生图"
  - "图生图"
  - "文生视频"
  - "图生视频"
  - "generate image"
  - "generate video"
---

# ComfyUI Agent Workbench Skill

## Overview
This skill equips any AI Agent (Gemini CLI, Claude Code, DeepSeek Harness, Antigravity, etc.) to act as a master ComfyUI creator. Instead of humans wiring nodes, the agent translates intent into execution parameters, schedules the appropriate ComfyUI workflow, monitors execution, and returns media outputs.

## Hardware & Environment
- **Host Specs**: 64GB System RAM, NVIDIA RTX 2080Ti (Modified 22GB VRAM, Turing Compute 7.5).
- **Service Endpoints**:
  - ComfyDesk API Gateway: `http://localhost:8001/api/v1` (or LAN IP)
  - ComfyUI Direct API: `http://localhost:8188`
  - JoyCaption vLLM API: `http://localhost:8000/v1`

## Available Workflows & Engines

| Capability | Workflow ID | Engine / Model | Recommended Resolution | Typical VRAM |
|---|---|---|---|---|
| ⚡ Fast Image Gen | `image_z_image_turbo` | Z-Image Turbo BF16 + Qwen TE | 1024x1024 / 1280x720 | ~4.5 GB |
| 👾 Pixel Art Image | `image_z_image_pixel` | Z-Image Turbo + Pixel LoRA | 1024x1024 | ~4.5 GB |
| 🎬 Text-to-Video | `video_minimax_h3_t2v` | MiniMax H3 (INT8 DiT + Qwen3-VL TE) | 1344x768 (20 steps) | ~16 GB (with audio) |
| 🎞️ Image-to-Video | `video_minimax_h3_i2v` | MiniMax H3 First-Frame Anchor | 1344x768 (20 steps) | ~16.5 GB |
| 🎥 Wan2.1 Video T2V | `video_wan22_ti2v_5b` | Wan2.1 5B Ti2V FP16 + UMT5-XXL | 1280x704 (20 steps) | ~14 GB |
| 📽️ Wan2.1 Video I2V | `video_wan22_ti2v_5b_i2v` | Wan2.1 5B I2V First-Frame Anchor | 1280x704 (20 steps) | ~14.5 GB |

## Invocation Patterns

### 1. Natural Language via ComfyDesk A2A Endpoint
```bash
curl -X POST http://localhost:8001/api/v1/a2a/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "绘制一张赛博朋克雨夜街道，一位身穿发光夹克的少女站在霓虹灯招牌下，水面有绚丽倒影，8k电影级光影",
    "mode": "auto"
  }'
```

### 2. Direct Function Call Execution
```bash
curl -X POST http://localhost:8001/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "image_z_image_turbo",
    "prompt": "masterpiece, best quality, cinematic lighting, cyberpunk rainy night street, girl in neon jacket, reflections in puddles",
    "negative_prompt": "blurry, low quality, deformed, distorted, bad anatomy",
    "width": 1024,
    "height": 1024,
    "steps": 8,
    "cfg": 1.5,
    "seed": -1
  }'
```

### 3. Monitoring & Polling
- Stream task progress via Server-Sent Events (SSE):
  `GET http://localhost:8001/api/v1/tasks/{task_id}/stream`
- Or poll task status:
  `GET http://localhost:8001/api/v1/tasks/{task_id}`
