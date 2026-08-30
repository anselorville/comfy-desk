"use client";

import { useState, useEffect, useRef } from "react";
import { sendAgentChat, subscribeTaskStream, TaskResponse, Storyboard, renderShot } from "../lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  kind?: "image" | "video" | "storyboard" | "text";
  taskId?: string;
  task?: TaskResponse;
  storyboard?: Storyboard;
  refImage?: string;
  createdAt: string;
}

const INSPIRATION_PROMPTS = [
  { label: "⚡ 赛博朋克雨夜少女", prompt: "赛博朋克雨夜街道，一位身穿发光霓虹夹克的少女站在广告牌下，水面有绚丽倒影，8k电影级光影", mode: "image" as const },
  { label: "🎬 电影镜头：海浪灯塔", prompt: "俯瞰视角，惊涛骇浪拍打着黑色悬崖上的白色灯塔，暴风雨天气，镜头缓慢向前推进", mode: "video" as const },
  { label: "🌸 新海诚风樱花小径", prompt: "日式小镇春天，微风吹拂樱花花瓣飘落，湛蓝天空与白云，新海诚动画唯美光影", mode: "image" as const },
  { label: "👾 复古像素地牢勇士", prompt: "16位复古像素艺术，地下城地牢深处手持发光宝剑的勇士，火把照明与暗影", mode: "image" as const },
  { label: "🎬 3镜头科幻短片分镜", prompt: "未来都市探员在雨夜追查仿生人的3镜头悬疑分镜", mode: "storyboard" as const },
];

export default function AgentCopilotPage() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"auto" | "image" | "video" | "storyboard">("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [preview, setPreview] = useState(false);
  const [refImage, setRefImage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "👋 你好！我是你的 ComfyUI 智能创作导演。\n直接告诉我你的画面或视频构想（例如「帮我画一张...」或「做一段运镜视频...」），我会自动编排最合适的工作流并调度显卡完成制作！",
      kind: "text",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRefImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (customText?: string, customMode?: "auto" | "image" | "video" | "storyboard") => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const currentMode = customMode || mode;
    const userMsgId = `user_${Date.now()}`;
    const agentMsgId = `agent_${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      refImage: refImage || undefined,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendAgentChat({
        message: textToSend,
        ref_image: refImage || undefined,
        mode: currentMode,
        aspect_ratio: aspectRatio,
        preview,
      });

      const agentMsg: ChatMessage = {
        id: agentMsgId,
        sender: "agent",
        text: res.reply,
        kind: res.kind || "text",
        taskId: res.task_id,
        storyboard: res.storyboard,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, agentMsg]);

      // If task was submitted, subscribe to live stream
      if (res.task_id) {
        subscribeTaskStream(res.task_id, (updatedTask) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId ? { ...msg, task: updatedTask } : msg
            )
          );
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "agent",
          text: `⚠️ 执行失败: ${err.message || "未知错误"}`,
          kind: "text",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnimateImage = (imgSrc: string) => {
    setRefImage(imgSrc);
    setMode("video");
    setInput("以这张图为首帧，让镜头缓慢推进，展现自然细腻的动态与光影变化");
  };

  const handleRenderStoryboardShot = async (sbId: string, shotId: string) => {
    try {
      await renderShot(sbId, shotId, preview);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.storyboard && msg.storyboard.id === sbId) {
            const updatedShots = msg.storyboard.shots.map((s) =>
              s.id === shotId ? { ...s, status: "rendering" as const, progress: 10 } : s
            );
            return { ...msg, storyboard: { ...msg.storyboard, shots: updatedShots } };
          }
          return msg;
        })
      );
    } catch (e: any) {
      alert(`渲染镜头失败: ${e.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Info Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            🤖 AI 智能创作助理
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            意图驱动 · 自动调度 MiniMax H3、Wan2.1 与 Z-Image 引擎 · 支持首帧锚定运镜
          </p>
        </div>

        {/* Global Quick Options */}
        <div className="flex items-center gap-2">
          {/* Aspect Ratio */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  aspectRatio === ratio
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Fast Preview Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer px-2.5 py-1.5 rounded-xl bg-slate-100/70 border border-slate-200/60 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span>快速预览</span>
          </label>
        </div>
      </div>

      {/* Main Grid: Chat Stream on Left & Canvas Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Chat Conversation Stream (col-span-5) */}
        <div className="lg:col-span-5 flex flex-col h-[740px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Conversation Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {msg.sender === "user" ? "你" : "✦ ComfyDesk Agent"}
                  </span>
                  <span className="text-[10px] text-slate-300">{msg.createdAt}</span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                    msg.sender === "user"
                      ? "bg-slate-900 text-white rounded-tr-xs"
                      : "bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-2xs"
                  }`}
                >
                  {/* If user attached image */}
                  {msg.refImage && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/20">
                      <img src={msg.refImage} alt="Reference" className="max-h-32 object-cover w-full" />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs text-xs text-indigo-600 font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
                  <span>Agent 正在规划工作流与调度 GPU...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Inspiration Prompts Bar */}
          <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pl-1.5">灵感:</span>
            {INSPIRATION_PROMPTS.map((insp, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(insp.prompt);
                  setMode(insp.mode);
                }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 border border-slate-200/70 text-slate-600 whitespace-nowrap transition-colors cursor-pointer"
              >
                {insp.label}
              </button>
            ))}
          </div>

          {/* Input Box & Attachment */}
          <div className="p-3 bg-white border-t border-slate-200/80 space-y-2">
            
            {/* Mode selection row */}
            <div className="flex items-center gap-1.5">
              {(["auto", "image", "video", "storyboard"] as const).map((m) => {
                const labels = { auto: "✨ 智能识别", image: "🖼️ 极速生图", video: "🎬 运镜视频", storyboard: "📖 导演分镜" };
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      mode === m
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-slate-100/80 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {labels[m]}
                  </button>
                );
              })}
            </div>

            {refImage && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-2">
                  <img src={refImage} alt="Ref" className="w-8 h-8 rounded-lg object-cover" />
                  <span className="text-[11px] font-semibold text-indigo-900">已附加参考图（用于图生视频/首帧锚定）</span>
                </div>
                <button
                  onClick={() => setRefImage("")}
                  className="text-xs text-indigo-400 hover:text-indigo-700 font-bold px-1.5"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="上传参考图 / 角色图"
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                🖼️
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="描述你想要的画面、镜头运动或分镜剧情..."
                className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  loading || !input.trim()
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95 shadow-xs"
                }`}
              >
                {loading ? "处理中..." : "发送 ✦"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Visual Canvas & Storyboard Gallery (col-span-7) */}
        <div className="lg:col-span-7 flex flex-col h-[740px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">创作画布与作品流</span>
              <span className="text-[10px] text-slate-400 font-mono">Live Stream</span>
            </div>
          </div>

          {/* Main Visual Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/40">
            {messages.filter((m) => m.task || m.storyboard).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-xl text-slate-400 mb-3 shadow-2xs">
                  ✦
                </div>
                <p className="text-sm font-semibold text-slate-600">等待生成任务</p>
                <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                  在左侧对话框输入您的创作意图，生成的图像、5秒视频及多镜头分镜将实时在此呈现。
                </p>
              </div>
            ) : (
              messages
                .filter((m) => m.task || m.storyboard)
                .map((msg) => {
                  const task = msg.task;
                  const sb = msg.storyboard;

                  // Render Single Generation Task (Image or Video)
                  if (task) {
                    const isRunning = task.status === "running" || task.status === "pending";
                    const isDone = task.status === "done";
                    const images = task.images || [];

                    return (
                      <div
                        key={msg.id}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 overflow-hidden transition-all"
                      >
                        {/* Task Card Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                isDone
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : task.status === "failed"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse"
                              }`}
                            >
                              {isDone ? "✓ 渲染完成" : task.status === "failed" ? "✕ 失败" : `渲染中 ${task.progress}%`}
                            </span>
                            <span className="text-xs text-slate-600 font-medium truncate max-w-xs">{msg.text}</span>
                          </div>

                          {images.length > 0 && (
                            <a
                              href={`/images/${images[0]}`}
                              download
                              className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 transition-colors"
                            >
                              ⬇ 下载原片
                            </a>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {isRunning && (
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden">
                            <div
                              className="bg-slate-900 h-full rounded-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        )}

                        {/* Media Display */}
                        {images.length > 0 ? (
                          <div className="space-y-3">
                            {images.map((src, i) => {
                              const fullUrl = `/images/${src}`;
                              const isVideo = /\.(mp4|webm)$/i.test(src);
                              return (
                                <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-black">
                                  {isVideo ? (
                                    <video src={fullUrl} controls playsInline autoPlay muted loop className="w-full max-h-[420px] object-contain mx-auto block" />
                                  ) : (
                                    <img src={fullUrl} alt="Output" className="w-full max-h-[420px] object-contain mx-auto block" />
                                  )}

                                  {/* Action overlay for images -> make into video */}
                                  {!isVideo && (
                                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                      <span className="text-[11px] text-slate-500">Z-Image Turbo 8K</span>
                                      <button
                                        onClick={() => handleAnimateImage(fullUrl)}
                                        className="text-xs font-semibold text-white bg-slate-900 hover:bg-black px-3 py-1 rounded-lg shadow-xs cursor-pointer active:scale-95 transition-all"
                                      >
                                        🎬 转换为5秒运镜视频 ✦
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : isRunning ? (
                          <div className="h-64 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                            <div className="w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                            <p className="text-xs font-semibold text-slate-600">ComfyUI 引擎正在生成中 ({task.progress}%)...</p>
                          </div>
                        ) : null}

                        {task.error && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                            <strong>渲染错误:</strong> {task.error}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Render Multi-shot Storyboard Plan
                  if (sb) {
                    return (
                      <div key={msg.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-slate-900">🎬 导演分镜计划: {sb.title}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {sb.shots.length} 个镜头 · {sb.aspect_ratio}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{sb.synopsis}</p>
                          </div>
                        </div>

                        {/* Shot Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {sb.shots.map((shot) => (
                            <div
                              key={shot.id}
                              className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-900">
                                    镜头 #{shot.shot_number}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                                    {shot.camera_movement}
                                  </span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-700 block">{shot.shot_type}</span>
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{shot.scene_description}</p>
                              </div>

                              {shot.video_url ? (
                                <video src={shot.video_url} controls playsInline loop className="w-full rounded-lg bg-black mt-2" />
                              ) : (
                                <button
                                  onClick={() => handleRenderStoryboardShot(sb.id, shot.id)}
                                  disabled={shot.status === "rendering"}
                                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-black text-white cursor-pointer transition-all shadow-2xs"
                                >
                                  {shot.status === "rendering" ? "渲染中..." : "渲染此镜头 🎬"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
