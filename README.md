# ComfyDesk — Autonomous Agent ComfyUI Workbench

> **A Single Clean, Agent-Native Workstation for Local ComfyUI Image Generation, AI Video Directing & Multi-Agent Collaboration.**

ComfyDesk 重新定义了 ComfyUI 的交互范式：从「复杂低效的手工节点连线」升级为**「Agent 意图驱动的自主创作工位」**。用户与外部 Agent 只需表达自然语言意图，ComfyDesk 会自动完成工作流编排、提示词精炼、镜头运镜控制、22GB 显存调度与端到端渲染。

---

## 🌟 核心特性 (Key Features)

### 1. 🤖 智能创作助理 (Agent Copilot)
- **零门槛自然语言对话**：输入意图（如「画一张赛博朋克雨夜下的少女」、「做一段海浪拍打悬崖的5秒运镜视频」），Agent 自动解析意图并匹配最佳工作流。
- **全自动工艺调度**：自动配置 Steps、CFG、画幅比例与负向提示词，小白与专业创作者均可秒级上手。
- **多模态图生视频**：支持上传参考图作为首帧，自动触发第一帧锚定视频生成。

### 2. 🎬 智能导演分镜工位 (Director Storyboard Studio)
- **剧本多镜头自动解构**：输入故事梗概，AI 导演自动分解为 3~6 个连贯分镜镜头（全景建立、中景推进、特写高潮等）。
- **专业运镜词汇库**：支持 `推进 (Dolly In)`、`拉远 (Dolly Out)`、`横摇 (Pan)`、`环绕 (Orbit)`、`升降 (Crane)` 等专业电影运镜。
- **多镜头连续渲染**：一键批量调度 MiniMax H3 或 Wan2.1 渲染全片，保持角色与画风一致性。

### 3. 🔌 Agent-to-Agent (A2A) 互联与 MCP 支持
- **为外部 Agent 赋能**：Gemini CLI、DeepSeek Harness、Claude Code、Cursor、AutoGen 等外部 Agent 只要接入 ComfyDesk，即可瞬间获得极速生图与电影视频制作能力。
- **标准 MCP 协议**：提供 `GET /api/v1/a2a/mcp` 与一键复制配置，秒级挂载为 Claude / Cursor / Gemini MCP 工具。
- **OpenAPI / Function Calling**：结构化提供 `generate_image`、`generate_video`、`create_storyboard`、`get_system_status` 等工具。

### 4. ⚡ 22GB 显存智能调度 (RTX 2080Ti Profile)
- **实时显存与温度监控**：实时采集 GPU 显存占用、温度与算力利用率。
- **智能互斥与内存释放**：MiniMax H3 (16GB)、Wan2.1 (14GB) 与 Z-Image Turbo 之间智能切换，提供一键显存释放 (`/api/v1/system/gpu-cleanup`)，杜绝 OOM。

### 5. 🎨 极简清新设计系统 (Design System)
- **全新纯净视觉规范**：告别厚重视效，采用苹果/Linear风格的白灰基底与 Indigo 交互色。
- **多媒体画廊与 Lightbox**：支持视频悬浮自动预览、全分辨率大图灯箱缩放与一键转为视频。
- **全功能移动随身版 (`/m`)**：针对局域网手机/平板触控优化，支持相机拍照上传、实时进度推送与即时保存。

---

## 🛠️ 全局 Agent 技能库 (Global Agent Skills)

所有 ComfyUI 核心技能已全局安装至 `~/.agents/skills/` 并自动软链接至各大 Agent 生态（Antigravity, Gemini CLI, Claude）：

| 技能名称 (Skill) | 目录 | 核心功能 |
|---|---|---|
| `comfyui-agent-workbench` | `~/.agents/skills/comfyui-agent-workbench` | 核心 ComfyUI 自动化与模型调度技能 |
| `ai-video-director` | `~/.agents/skills/ai-video-director` | 剧本分镜解构、镜头运镜设计与连续视频生成 |
| `comfyui-prompt-stylist` | `~/.agents/skills/comfyui-prompt-stylist` | 视觉风格分类、JoyCaption 视觉反推与负词公式 |
| `comfyui-character-consistency` | `~/.agents/skills/comfyui-character-consistency` | 角色一致性锚定与多镜头人物维持 |
| `comfyui-resource-manager` | `~/.agents/skills/comfyui-resource-manager` | 22GB VRAM 显存调度与 Turing 架构优化 |
| `a2a-comfydesk-client` | `~/.agents/skills/a2a-comfydesk-client` | 外部 Agent 连接 ComfyDesk 的标准协议规范 |
| `seedance-prompt-library` | `skills/seedance-prompt-library`（含 12 个分类 Skill） | [awesome-seedance](https://github.com/LearnPrompt/awesome-seedance) 实测提示语模板库：463 条已验证 Seedance 案例蒸馏出的类型化模板（时间轴分镜、接触点动作、器材缺陷真实感等），中英双语，MIT/CC BY 4.0 |

> **Seedance 技能层说明**：`skills/seedance-*`（12 个）来自 awesome-seedance 上游，是「模板层」，与 `ai-video-director`（方法论层）和 `comfyui-character-consistency`（一致性层）互补。上游每日更新，更新方式：`cd /data/git_repository/awesome-seedance && git pull`（全局技能通过软链自动跟随）。

---

## 🚀 快速启动 (Quick Start)

### 1. 启动后端网关与前端
```bash
# 激活环境
source .venv/bin/activate

# 启动 FastAPI Gateway (8001端口)
uvicorn gateway.main:app --host 0.0.0.0 --port 8001 --reload

# 启动 Next.js 前端 (3000端口)
cd frontend && npm run dev
```

### 2. 外部 Agent 接入 (MCP 配置示例)
在 Claude Desktop / Gemini / Cursor 的配置中加入：
```json
{
  "mcpServers": {
    "comfydesk": {
      "url": "http://<局域网IP>:8001/api/v1/a2a/mcp",
      "type": "http"
    }
  }
}
```

### 3. API 快速测试
```bash
# 1. 意图驱动生成
curl -X POST http://localhost:8001/api/v1/a2a/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "赛博朋克雨夜少女", "mode": "image"}'

# 2. 获取实时显存状态
curl http://localhost:8001/api/v1/system/gpu
```
