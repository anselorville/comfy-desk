"use client";

import { useState, useCallback, useEffect } from "react";
import {
  generate,
  waitForTask,
  listWorkflows,
  type TaskResponse,
  type WorkflowMeta,
} from "@/lib/api";

const ASPECT_RATIOS = [
  { label: "1:1", w: 1024, h: 1024 },
  { label: "3:4", w: 768, h: 1024 },
  { label: "4:3", w: 1024, h: 768 },
  { label: "16:9", w: 1280, h: 720 },
  { label: "9:16", w: 720, h: 1280 },
];

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, watermark, text, signature");
  const [workflow, setWorkflow] = useState("txt2img_sdxl");
  const [steps, setSteps] = useState(28);
  const [cfg, setCfg] = useState(7);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [seed, setSeed] = useState(-1);
  const [lora, setLora] = useState("");
  const [loraStrength, setLoraStrength] = useState(0.8);
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);

  useEffect(() => {
    listWorkflows().then(setWorkflows).catch(console.error);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setTask(null);
    setResultImages([]);

    try {
      const ar = ASPECT_RATIOS[aspectIdx];
      const { task_id } = await generate({
        prompt,
        negative_prompt: negPrompt,
        workflow,
        steps,
        cfg,
        width: ar.w,
        height: ar.h,
        seed,
        lora,
        lora_strength: loraStrength,
      });

      await waitForTask(task_id, (t) => {
        setTask(t);
        if (t.status === "done") {
          setResultImages(t.images);
        }
      });
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [prompt, negPrompt, workflow, steps, cfg, aspectIdx, seed, lora, loraStrength]);

  const progress = task?.progress ?? 0;
  const status = task?.status ?? "idle";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ── Left panel: Controls ─────────────────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="mb-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
              AI 创作工作站
            </h1>
            <p className="mt-2 text-slate-500 text-sm font-medium">
              输入您的创意，开始生成高品质 AI 图像。
            </p>
          </div>

          {/* Prompt */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                正向提示词
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="一个宁静的花园，金色的阳光，电影感散景..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                负向提示词
              </label>
              <textarea
                value={negPrompt}
                onChange={(e) => setNegPrompt(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Workflow & Aspect */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                模型选择
              </label>
              <div className="flex flex-wrap gap-2">
                {workflows.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setWorkflow(p.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                      workflow === p.id
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                画幅比例
              </label>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((a, i) => (
                  <button
                    key={a.label}
                    onClick={() => setAspectIdx(i)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                      aspectIdx === i
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  步数 (Steps)
                </label>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {steps}
                </span>
              </div>
              <input
                type="range" min={10} max={100} value={steps}
                onChange={(e) => setSteps(+e.target.value)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  CFG 指导
                </label>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {cfg.toFixed(1)}
                </span>
              </div>
              <input
                type="range" min={1} max={20} step={0.5} value={cfg}
                onChange={(e) => setCfg(+e.target.value)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Seed
              </label>
              <input
                type="number" value={seed}
                onChange={(e) => setSeed(+e.target.value)}
                placeholder="-1 (随机)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* LoRA */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                LoRA 模型名
              </label>
              <input
                type="text" value={lora}
                onChange={(e) => setLora(e.target.value)}
                placeholder="例如: anime_style"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  LoRA 权重
                </label>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {loraStrength.toFixed(2)}
                </span>
              </div>
              <input
                type="range" min={0} max={2} step={0.05} value={loraStrength}
                onChange={(e) => setLoraStrength(+e.target.value)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className={`w-full py-4 rounded-2xl text-sm font-black tracking-widest uppercase transition-all shadow-md active:scale-[0.98] ${
              loading || !prompt.trim()
                ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
            }`}
          >
            {loading ? "⌛ 处理中..." : "✦ 立即生成"}
          </button>
        </div>

        {/* ── Right panel: Output ─────────────────────────────────────── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">创作画布</h2>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">{status === "running" ? "渲染中" : "入队中"}</span>
              </div>
            )}
          </div>

          {/* Output Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm min-h-[600px] flex flex-col relative overflow-hidden">
            {loading && (
              <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-50 overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {resultImages.length > 0 ? (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[800px] pr-2">
                {resultImages.map((src, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm transition-all hover:shadow-xl">
                    <img src={src} alt="Generated" className="w-full block" />
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={src} download
                        className="px-4 py-2 bg-white/90 backdrop-blur text-indigo-700 text-xs font-black rounded-xl shadow-lg border border-white hover:bg-white transition-colors uppercase tracking-widest"
                      >
                        下载
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : !loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-300">
                <div className="w-20 h-20 rounded-full border-4 border-slate-50 flex items-center justify-center text-4xl">
                  ✦
                </div>
                <p className="text-sm font-semibold tracking-wide text-slate-400">
                  准备就绪，尽情挥洒创意
                </p>
              </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 border-8 border-slate-50 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-indigo-600">
                            {progress}%
                        </div>
                    </div>
                    <p className="text-sm font-black text-indigo-600 animate-pulse tracking-widest uppercase">图像合成中</p>
                </div>
            )}

            {task?.error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                <span className="text-red-500 text-lg">⚠️</span>
                <div>
                    <h4 className="text-xs font-black text-red-700 uppercase tracking-widest">错误详情</h4>
                    <p className="text-xs text-red-600 mt-1">{task.error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
