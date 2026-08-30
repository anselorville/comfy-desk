"use client";

import { useState, useEffect, useRef } from "react";
import {
  sendAgentChat,
  subscribeTaskStream,
  TaskResponse,
  GpuTelemetry,
  fetchGpuTelemetry,
  resolveImageUrl,
} from "../../lib/api";

interface MobileTaskItem {
  id: string;
  text: string;
  taskId?: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  mediaUrl?: string;
  isVideo?: boolean;
  error?: string;
  createdAt: string;
}

export default function MobilePage() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"auto" | "video" | "image" | "storyboard">("auto");
  const [refImage, setRefImage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gpu, setGpu] = useState<GpuTelemetry | null>(null);
  const [tasks, setTasks] = useState<MobileTaskItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGpuTelemetry().then(setGpu).catch(console.error);
    const t = setInterval(() => {
      fetchGpuTelemetry().then(setGpu).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRefImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!input.trim() || loading) return;
    const currentInput = input;
    const currentRef = refImage;
    setInput("");
    setRefImage("");
    setLoading(true);

    const localId = `m_task_${Date.now()}`;
    const newTask: MobileTaskItem = {
      id: localId,
      text: currentInput,
      status: "pending",
      progress: 10,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setTasks((prev) => [newTask, ...prev]);

    try {
      const res = await sendAgentChat({
        message: currentInput,
        ref_image: currentRef || undefined,
        mode: mode,
        aspect_ratio: "9:16",
        preview: false,
      });

      if (res.task_id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === localId ? { ...t, taskId: res.task_id, status: "running" } : t))
        );

        subscribeTaskStream(res.task_id, (updatedTask: TaskResponse) => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.taskId === res.task_id) {
                const images = updatedTask.images || [];
                const firstImg = images[0];
                const isVideo = firstImg ? /\.(mp4|webm)$/i.test(firstImg) : false;
                return {
                  ...t,
                  status: updatedTask.status,
                  progress: updatedTask.progress,
                  mediaUrl: firstImg ? resolveImageUrl(firstImg) : t.mediaUrl,
                  isVideo,
                  error: updatedTask.error || undefined,
                };
              }
              return t;
            })
          );
        });
      }
    } catch (e: any) {
      setTasks((prev) =>
        prev.map((t) => (t.id === localId ? { ...t, status: "failed", error: e.message } : t))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Sticky Mobile App Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-sm">
            ✦
          </div>
          <span className="font-extrabold text-sm text-slate-900 tracking-tight">ComfyDesk 随身版</span>
        </div>

        {gpu && gpu.available && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>22G 在线 · {gpu.temperature_c}°C</span>
          </div>
        )}
      </header>

      {/* Main Content Stream */}
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        
        {/* Mobile Composer Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(["auto", "video", "image", "storyboard"] as const).map((m) => {
              const labels = { auto: "✨ 智能识别", video: "🎬 运镜视频", image: "🖼️ 极速生图", storyboard: "📖 导演分镜" };
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    mode === m
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {/* Reference Image Preview if present */}
          {refImage && (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-28 bg-black flex items-center justify-center">
              <img src={refImage} alt="Reference" className="max-h-28 object-contain" />
              <button
                onClick={() => setRefImage("")}
                className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold"
              >
                ✕ 移除
              </button>
            </div>
          )}

          {/* Input Textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="说出你想生成的画面或运镜动作..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none leading-relaxed"
          />

          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-2 pt-1">
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
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              <span>📷</span>
              <span>拍照/选图</span>
            </button>

            <button
              onClick={handleCreate}
              disabled={loading || !input.trim()}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-xs ${
                loading || !input.trim()
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95"
              }`}
            >
              {loading ? "Agent 调度中..." : "立即创作 ✦"}
            </button>
          </div>
        </div>

        {/* Task Cards Stream */}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                  task.status === "done"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : task.status === "failed"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse"
                }`}
              >
                {task.status === "done" ? "✓ 渲染完成" : task.status === "failed" ? "✕ 失败" : `渲染中 ${task.progress}%`}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{task.createdAt}</span>
            </div>

            <p className="text-xs text-slate-800 font-medium leading-relaxed">{task.text}</p>

            {/* Progress Bar */}
            {(task.status === "running" || task.status === "pending") && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-slate-900 h-full rounded-full transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            )}

            {/* Media Player */}
            {task.mediaUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-black">
                {task.isVideo ? (
                  <video
                    src={task.mediaUrl}
                    controls
                    playsInline
                    loop
                    className="w-full max-h-[360px] object-contain mx-auto"
                  />
                ) : (
                  <img src={task.mediaUrl} alt="Result" className="w-full max-h-[360px] object-contain mx-auto" />
                )}
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">{task.isVideo ? "MP4 视频" : "PNG 图像"}</span>
                  <a
                    href={task.mediaUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-black"
                  >
                    ⬇ 保存原片
                  </a>
                </div>
              </div>
            )}

            {task.error && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
                {task.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
