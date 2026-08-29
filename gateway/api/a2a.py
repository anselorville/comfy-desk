"""
Agent-to-Agent (A2A) and MCP Protocol Router
Allows external AI Agents (Gemini CLI, DeepSeek Harness, Claude Code, etc.) to command ComfyDesk.
"""
import logging
from typing import Any
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from services import a2a_service
from services.a2a_service import A2A_TOOLS
from services.gpu_manager import get_gpu_telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Natural language intent / prompt")
    ref_image: str = Field("", description="Optional URL or filename of reference image")
    mode: str = Field("auto", description="auto | image | video | storyboard")
    aspect_ratio: str = Field("16:9", description="1:1 | 16:9 | 9:16 | 4:3")
    preview: bool = Field(False, description="Fast preview mode")


class ToolCallRequest(BaseModel):
    name: str = Field(..., description="Tool name, e.g. generate_image, generate_video, create_storyboard")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Arguments for the tool")


@router.get("/a2a/capabilities")
@router.get("/a2a/tools")
async def get_tools():
    """Get the standard OpenAI/Gemini/Anthropic function calling tool definitions."""
    return {
        "provider": "ComfyDesk",
        "version": "1.0.0",
        "description": "ComfyUI Multi-Modal Media Foundry & Video Director",
        "tools": A2A_TOOLS,
    }


@router.post("/a2a/tools/call")
async def call_tool(req: ToolCallRequest):
    """Execute a tool directly via function calling."""
    try:
        res = await a2a_service.execute_tool(req.name, req.arguments)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("A2A Tool execution failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/a2a/chat")
async def agent_chat(req: AgentChatRequest):
    """Conversational intent-to-media synthesis endpoint."""
    try:
        res = await a2a_service.handle_agent_chat(
            message=req.message,
            ref_image=req.ref_image,
            mode=req.mode,
            aspect_ratio=req.aspect_ratio,
            preview=req.preview,
        )
        return res
    except Exception as e:
        logger.exception("A2A Chat synthesis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/a2a/mcp")
@router.get("/mcp")
async def get_mcp_manifest(request: Request):
    """Standard Model Context Protocol (MCP) server manifest."""
    base_url = str(request.base_url).rstrip("/")
    return {
        "name": "comfydesk-media-foundry",
        "version": "1.0.0",
        "description": "Autonomous ComfyUI Image/Video/Director Workstation for AI Agents",
        "serverInfo": {
            "name": "ComfyDesk Gateway",
            "version": "1.0.0"
        },
        "endpoints": {
            "tools_list": f"{base_url}/api/v1/a2a/tools",
            "tools_call": f"{base_url}/api/v1/a2a/tools/call",
            "chat": f"{base_url}/api/v1/a2a/chat",
            "telemetry": f"{base_url}/api/v1/system/gpu",
        },
        "tools": [t["function"] for t in A2A_TOOLS],
        "hardware": get_gpu_telemetry(),
        "client_config_example": {
            "mcpServers": {
                "comfydesk": {
                    "url": f"{base_url}/api/v1/a2a/mcp",
                    "type": "http"
                }
            }
        }
    }
