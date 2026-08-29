---
name: a2a-comfydesk-client
description: |
  Standard Agent-to-Agent (A2A) protocol for external agents (Gemini CLI, DeepSeek, Claude, etc.)
  to connect and execute image/video generation via ComfyDesk.
triggers:
  - "a2a"
  - "agent-to-agent"
  - "外部agent"
  - "mcp"
  - "gemini cli"
  - "deepseek harness"
---

# Agent-to-Agent (A2A) Integration Protocol

## Overview
ComfyDesk serves as an AI Media Foundry for other agents. Any agent with HTTP, SSE, or MCP capabilities can interface with ComfyDesk to generate images, videos, and multi-shot storyboards.

## Integration Protocols

### 1. OpenAPI & JSON-RPC
- Base URL: `http://<COMFYDESK_HOST>:8001/api/v1`
- Swagger Docs: `http://<COMFYDESK_HOST>:8001/api/docs`
- OpenAPI JSON: `http://<COMFYDESK_HOST>:8001/api/openapi.json`

### 2. Standard MCP Server Config (for Claude Code, Gemini CLI, Cursor, Antigravity)
Add this to your agent's MCP configuration (`mcpServers`):
```json
{
  "comfydesk": {
    "url": "http://localhost:8001/api/v1/a2a/mcp"
  }
}
```

### 3. A2A Tool Schema (Function Calling)

#### Tool 1: `generate_image`
```json
{
  "name": "generate_image",
  "description": "Generate high quality images using ComfyUI workflows",
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {"type": "string", "description": "English visual prompt"},
      "style": {"type": "string", "enum": ["photorealistic", "anime", "cyberpunk", "pixel_art", "3d_render"], "default": "photorealistic"},
      "width": {"type": "integer", "default": 1024},
      "height": {"type": "integer", "default": 1024}
    },
    "required": ["prompt"]
  }
}
```

#### Tool 2: `generate_video`
```json
{
  "name": "generate_video",
  "description": "Generate cinematic AI video with camera motion and audio using MiniMax H3 or Wan2.1",
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {"type": "string", "description": "Prompt with scene and camera motion"},
      "reference_image_url": {"type": "string", "description": "Optional starting frame image URL"},
      "model": {"type": "string", "enum": ["minimax_h3", "wan2.1"], "default": "minimax_h3"},
      "preview": {"type": "boolean", "default": false}
    },
    "required": ["prompt"]
  }
}
```

#### Tool 3: `create_storyboard`
```json
{
  "name": "create_storyboard",
  "description": "Plan and generate a multi-shot video storyboard sequence",
  "parameters": {
    "type": "object",
    "properties": {
      "synopsis": {"type": "string", "description": "Story outline or script"},
      "num_shots": {"type": "integer", "default": 3},
      "style": {"type": "string", "default": "cinematic"}
    },
    "required": ["synopsis"]
  }
}
```
