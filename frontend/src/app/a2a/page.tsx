"use client";

import { useState, useEffect } from "react";
import { fetchA2ATools, fetchMcpManifest, API_BASE } from "../../lib/api";

export default function A2AHubPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [mcpData, setMcpData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"mcp" | "gemini" | "deepseek" | "curl">("mcp");
  const [copied, setCopied] = useState(false);

  // Test tool state
  const [testTool, setTestTool] = useState("generate_image");
  const [testArgs, setTestArgs] = useState('{\n  "prompt": "cyberpunk rainy city neon reflections 8k",\n  "style": "photorealistic"\n}');
  const [testOutput, setTestOutput] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchA2ATools().then((d) => setTools(d.tools || [])).catch(console.error);
    fetchMcpManifest().then(setMcpData).catch(console.error);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunToolTest = async () => {
    setTesting(true);
    setTestOutput("正在通过 A2A 协议调用后端工具...");
    try {
      const parsed = JSON.parse(testArgs);
      const res = await fetch(`${API_BASE}/a2a/tools/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testTool, arguments: parsed }),
      });
      const data = await res.json();
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setTestOutput(`调用失败: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const mcpConfigText = JSON.stringify(
    {
      mcpServers: {
        comfydesk: {
          url: `${API_BASE}/a2a/mcp`,
          type: "http",
        },
      },
    },
    null,
    2
  );

  const geminiPythonSnippet = `import httpx

# 调用 ComfyDesk A2A 接口生成高画质图像 / 视频
async def create_media_with_comfydesk(prompt: str, is_video: bool = False):
    url = "${API_BASE}/a2a/chat"
    payload = {
        "message": prompt,
        "mode": "video" if is_video else "image",
        "aspect_ratio": "16:9"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload)
        return resp.json()

# 示例: 让 Gemini 编排生成
# result = await create_media_with_comfydesk("赛博朋克雨夜下的少女", is_video=True)`;

  const deepseekPythonSnippet = `from openai import OpenAI

# 通过 OpenAI 兼容格式或直接 HTTP 协议连接 ComfyDesk
client = OpenAI(base_url="${API_BASE}/a2a", api_key="sk-comfydesk-local")

# 或者直接调用 Tool Call Endpoint:
# POST ${API_BASE}/a2a/tools/call
# Body: {"name": "generate_video", "arguments": {"prompt": "cinematic camera dolly in"}}`;

  const curlSnippet = `curl -X POST ${API_BASE}/a2a/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "生成一段电影级海浪拍打灯塔的5秒运镜视频",
    "mode": "video",
    "aspect_ratio": "16:9"
  }'`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-slate-900">🔌 Agent-to-Agent (A2A) 互联中心</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
            Open Protocol
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          为外部 AI Agent（Gemini CLI、DeepSeek Harness、Claude Code、Cursor、AutoGen 等）提供即插即用的 ComfyUI 图像/视频/导演创作能力
        </p>
      </div>

      {/* Connection Protocol Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { id: "mcp" as const, title: "⚡ MCP 协议 (Claude / Cursor)", desc: "标准 Model Context Protocol，一键接入" },
          { id: "gemini" as const, title: "🤖 Gemini CLI / SDK", desc: "Python / TS 双向原生调用支持" },
          { id: "deepseek" as const, title: "🧠 DeepSeek Harness", desc: "OpenAI Function Calling 格式支持" },
          { id: "curl" as const, title: "🌐 REST & SSE Webhook", desc: "标准 HTTP JSON 与进度流订阅" },
        ].map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              activeTab === tab.id
                ? "border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <h3 className="text-xs font-bold text-slate-900">{tab.title}</h3>
            <p className="text-[11px] text-slate-500 mt-1">{tab.desc}</p>
          </div>
        ))}
      </div>

      {/* Code Snippet Box */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-5 text-white space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-mono text-slate-400">
            {activeTab === "mcp" && "MCP Configuration JSON"}
            {activeTab === "gemini" && "Gemini Python Integration Snippet"}
            {activeTab === "deepseek" && "DeepSeek / OpenAI Function Calling"}
            {activeTab === "curl" && "cURL Command"}
          </span>
          <button
            onClick={() => {
              const text =
                activeTab === "mcp"
                  ? mcpConfigText
                  : activeTab === "gemini"
                  ? geminiPythonSnippet
                  : activeTab === "deepseek"
                  ? deepseekPythonSnippet
                  : curlSnippet;
              handleCopy(text);
            }}
            className="text-xs font-bold px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
          >
            {copied ? "✓ 已复制到剪贴板" : "复制配置代码 📋"}
          </button>
        </div>

        <pre className="text-xs font-mono text-emerald-400 overflow-x-auto p-2 bg-slate-950 rounded-xl leading-relaxed">
          {activeTab === "mcp" && mcpConfigText}
          {activeTab === "gemini" && geminiPythonSnippet}
          {activeTab === "deepseek" && deepseekPythonSnippet}
          {activeTab === "curl" && curlSnippet}
        </pre>
      </div>

      {/* Interactive Tool Test Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Tool Invoker (col-span-6) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">🧪 A2A 工具在线调试控制台</h3>
            <span className="text-xs text-slate-400">模拟外部 Agent 发起调用</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">选择调用的 Tool</label>
            <select
              value={testTool}
              onChange={(e) => {
                setTestTool(e.target.value);
                if (e.target.value === "generate_image") {
                  setTestArgs('{\n  "prompt": "masterpiece cyberpunk rainy street 8k",\n  "style": "photorealistic",\n  "aspect_ratio": "16:9"\n}');
                } else if (e.target.value === "generate_video") {
                  setTestArgs('{\n  "prompt": "cinematic ocean waves crashing into lighthouse",\n  "camera_movement": "dolly_in",\n  "model": "minimax_h3"\n}');
                } else if (e.target.value === "create_storyboard") {
                  setTestArgs('{\n  "synopsis": "赛博朋克探员在雨夜追查仿生人",\n  "num_shots": 3,\n  "style": "cinematic"\n}');
                } else {
                  setTestArgs('{}');
                }
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium"
            >
              <option value="generate_image">generate_image (极速生图)</option>
              <option value="generate_video">generate_video (电影视频/配音)</option>
              <option value="create_storyboard">create_storyboard (导演分镜)</option>
              <option value="get_system_status">get_system_status (GPU 显存监测)</option>
              <option value="gpu_cleanup">gpu_cleanup (释放显存)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tool Arguments (JSON)</label>
            <textarea
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
              rows={6}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRunToolTest}
            disabled={testing}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              testing
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer active:scale-95"
            }`}
          >
            {testing ? "正在执行 Tool Call..." : "🚀 模拟外部 Agent 发起调用"}
          </button>
        </div>

        {/* Right: Response output (col-span-6) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">返回响应 (Execution Response)</h3>
              <span className="text-xs text-slate-400 font-mono">JSON</span>
            </div>
            <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono min-h-[220px] max-h-[300px] overflow-y-auto custom-scrollbar">
              {testOutput || "// 点击左侧按钮发起调用后在此查看 A2A 结构化返回数据"}
            </pre>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>端点: <code>POST {API_BASE}/a2a/tools/call</code></span>
            <span className="font-semibold text-emerald-600">✓ 200 OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
