"use client";

import { useState, useEffect, useRef } from "react";
import {
  promptExpertChat,
  resetPromptExpertSession,
  fetchPromptExpertHealth,
  generate,
  subscribeTaskStream,
  resolveImageUrl,
  PromptExpertResponse,
  TaskResponse,
} from "@/lib/api";

interface ExpertMsg {
  id: string;
  sender: "user" | "agent";
  text: string;
  result?: PromptExpertResponse;
  createdAt: string;
  genTask?: TaskResponse;
}

const FIRST_TURN_IDEAS = [
  "雨夜赛博朋克城市街头，霓虹倒影，电影感",
  "古风水墨意境的雪山与孤舟",
  "复古像素风太空探险游戏封面",
  "法式胶片旅拍人像，黄金时刻逆光",
  "3D 皮克斯风格的小恐龙角色设定",
  "极简摄影棚产品广告，柔和渐变背景",
];

function snapDim(v: number | undefined, fallback: number): number {
  const base = typeof v === "number" && v > 0 ? v : fallback;
  const snapped = Math.round(base / 16) * 16;
  return Math.min(1024, Math.max(256, snapped));
}

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PromptExpertPage() {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [messages, setMessages] = useState<ExpertMsg[]>([
    {
      id: "welcome",
      sender: "agent",
      text:
        "✍️ 我是你的「图像生成提示词专家」。\n把哪怕很模糊的想法告诉我就行（比如「想画一个雨夜撑伞的少女」），我会通过几轮简短对话，把它打磨成一条专业、稳定、可直接出图的文生图提示词，并可一键生成图片。",
      createdAt: timeNow(),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPromptExpertHealth()
      .then((h) => setLlmOk(h.llm_configured))
      .catch(() => setLlmOk(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch {}
  };

  const handleReset = async () => {
    if (sessionId) {
      try {
        await resetPromptExpertSession(sessionId);
      } catch {}
    }
    setSessionId("");
    setInput("");
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: "agent",
        text: "🔄 已开启新的创作会话。说说你想生成什么样的画面吧！",
        createdAt: timeNow(),
      },
    ]);
  };

  const handleSend = async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: "user", text, createdAt: timeNow() },
    ]);
    setLoading(true);
    try {
      const res = await promptExpertChat(text, sessionId);
      if (res.session_id) setSessionId(res.session_id);
      const agentText =
        res.status === "clarify"
          ? res.question_zh || "能再多说一点吗？"
          : res.explanation_zh || "已为你生成成品提示词，可在下方一键出图。";
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: agentText,
          result: res,
          createdAt: timeNow(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          sender: "agent",
          text: `⚠️ 提示词专家暂时不可用：${err.message || "未知错误"}`,
          createdAt: timeNow(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (msgId: string, result: PromptExpertResponse) => {
    const params = result.params || {};
    try {
      const { task_id } = await generate({
        prompt: result.positive_prompt || "",
        negative_prompt: result.negative_prompt || "",
        workflow: "image_qwen21_t2i",
        steps: 20,
        cfg: 1.0,
        width: snapDim(params.width, 768),
        height: snapDim(params.height, 1024),
        seed: -1,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                genTask: {
                  task_id,
                  status: "pending",
                  progress: 0,
                  images: [],
                  error: null,
                },
              }
            : m
        )
      );
      subscribeTaskStream(task_id, (t) => {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, genTask: t } : m)));
      });
    } catch (err: any) {
      alert(`生成失败：${err.message}`);
    }
  };

  const taskMsgs = messages.filter((m) => m.genTask);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              ✍️ 图像生成提示词专家
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Prompt Expert
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            多轮对话澄清意图 · 融合自有风格技能库 · 输出可直接出图的专业正/负向提示词
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              llmOk
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {llmOk === null ? "检测模型..." : llmOk ? "● LLM 已连接" : "○ 离线兜底模式"}
          </span>
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200/70 transition-colors cursor-pointer"
          >
            新会话
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 flex flex-col h-[780px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <span className="text-xs font-bold">💬 创作对话</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {sessionId ? `session ${sessionId}` : "未开始"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {msg.sender === "user" ? "你" : "✍️ Prompt Expert"}
                  </span>
                  <span className="text-[10px] text-slate-300">{msg.createdAt}</span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[92%] ${
                    msg.sender === "user"
                      ? "bg-slate-900 text-white rounded-tr-xs"
                      : "bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-2xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.result?.status === "final" && (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl border border-indigo-100 bg-white p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase">
                            Positive Prompt
                          </span>
                          <button
                            onClick={() => copy(msg.result!.positive_prompt || "", `${msg.id}_pos`)}
                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            {copiedKey === `${msg.id}_pos` ? "已复制 ✓" : "复制"}
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-slate-700 break-words">
                          {msg.result.positive_prompt}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Negative Prompt
                          </span>
                          <button
                            onClick={() => copy(msg.result!.negative_prompt || "", `${msg.id}_neg`)}
                            className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            {copiedKey === `${msg.id}_neg` ? "已复制 ✓" : "复制"}
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600 break-words">
                          {msg.result.negative_prompt}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {msg.result.skill_id && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            skill: {msg.result.skill_id}
                          </span>
                        )}
                        {msg.result.params && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {msg.result.params.width}×{msg.result.params.height} · steps{" "}
                            {msg.result.params.steps} · cfg {msg.result.params.cfg}
                          </span>
                        )}
                      </div>

                      {msg.result.followups_zh && msg.result.followups_zh.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {msg.result.followups_zh.map((f, i) => (
                            <button
                              key={i}
                              onClick={() => handleSend(f)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-800 transition-colors cursor-pointer"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => handleGenerate(msg.id, msg.result!)}
                        className="w-full mt-1 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                      >
                        🖼️ 用此提示词生成图片 ✦
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs text-xs text-indigo-600 font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
                  <span>提示词专家正在推敲措辞...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100 p-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2">
              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pl-1.5">
                灵感:
              </span>
              {FIRST_TURN_IDEAS.map((idea, i) => (
                <button
                  key={i}
                  onClick={() => setInput(idea)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 border border-slate-200/70 text-slate-600 whitespace-nowrap transition-colors cursor-pointer"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-white border-t border-slate-200/80">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="描述你想生成的画面（主体 / 风格 / 光线 / 比例）..."
                className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  loading || !input.trim()
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95 shadow-xs"
                }`}
              >
                {loading ? "思考中..." : "发送 ✦"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col h-[780px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900">出图画布</span>
            <span className="text-[10px] text-slate-400 font-mono">Live Output</span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/40">
            {taskMsgs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-xl text-slate-400 mb-3 shadow-2xs">
                  ✍️
                </div>
                <p className="text-sm font-semibold text-slate-600">等待成品提示词</p>
                <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                  在左侧与提示词专家对话，打磨出满意的提示词后点击「生成图片」，结果将实时在此呈现。
                </p>
              </div>
            ) : (
              taskMsgs.map((msg) => {
                const task = msg.genTask!;
                const isRunning = task.status === "running" || task.status === "pending";
                const isDone = task.status === "done";
                const images = task.images || [];
                return (
                  <div
                    key={msg.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isDone
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : task.status === "failed"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse"
                        }`}
                      >
                        {isDone
                          ? "✓ 渲染完成"
                          : task.status === "failed"
                          ? "✕ 失败"
                          : `渲染中 ${task.progress}%`}
                      </span>
                      {images.length > 0 && (
                        <a
                          href={resolveImageUrl(images[0])}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 transition-colors"
                        >
                          ⬇ 下载原图
                        </a>
                      )}
                    </div>

                    {isRunning && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div
                          className="bg-slate-900 h-full rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                    )}

                    {images.length > 0 ? (
                      images.map((src, i) => (
                        <div
                          key={i}
                          className="rounded-xl overflow-hidden border border-slate-200 bg-black"
                        >
                          <img
                            src={resolveImageUrl(src)}
                            alt="Output"
                            className="w-full max-h-[460px] object-contain mx-auto block"
                          />
                        </div>
                      ))
                    ) : isRunning ? (
                      <div className="h-64 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                        <div className="w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                        <p className="text-xs font-semibold text-slate-600">
                          ComfyUI 引擎正在生成中 ({task.progress}%)...
                        </p>
                      </div>
                    ) : null}

                    {task.error && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                        <strong>渲染错误:</strong> {task.error}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
