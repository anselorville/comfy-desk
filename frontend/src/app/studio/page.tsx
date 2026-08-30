"use client";

import { useState, useRef } from "react";
import { generate, generateAuto, subscribeTaskStream, TaskResponse, resolveImageUrl } from "../../lib/api";

const MODEL_OPTIONS = [
  { id: "image_z_image_turbo", label: "⚡ Z-Image Turbo 极速绘图 (BF16)", type: "image", defaultSteps: 8, defaultCfg: 1.5 },
  { id: "image_z_image_pixel", label: "👾 复古像素风 Pixel Art (LoRA)", type: "image", defaultSteps: 8, defaultCfg: 2.0 },
  { id: "video_minimax_h3_t2v", label: "🎬 MiniMax H3 电影视频 (原生配音)", type: "video", defaultSteps: 20, defaultCfg: 5.0 },
  { id: "video_wan22_ti2v_5b", label: "🎥 Wan2.1 5B 电影视频 (高动态)", type: "video", defaultSteps: 20, defaultCfg: 5.0 },
];

export default function QuickStudioPage() {
  const [model, setModel] = useState(MODEL_OPTIONS[0].id);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string>("");

  // Pro mode controls
  const [showPro, setShowPro] = useState(false);
  const [steps, setSteps] = useState(8);
  const [cfg, setCfg] = useState(1.5);
  const [seed, setSeed] = useState(-1);

  // Execution state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModelChange = (mId: string) => {
    setModel(mId);
    const m = MODEL_OPTIONS.find((opt) => opt.id === mId);
    if (m) {
      setSteps(m.defaultSteps);
      setCfg(m.defaultCfg);
      if (m.type === "video" && aspectRatio === "1:1") {
        setAspectRatio("16:9");
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      setRefImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setProgress(5);
    setStatusText("正在提交任务至 ComfyUI...");
    setError(null);

    const dims = {
      "1:1": [1024, 1024],
      "16:9": model.includes("minimax") ? [1344, 768] : [1280, 704],
      "9:16": model.includes("minimax") ? [768, 1344] : [704, 1280],
      "4:3": [1024, 768],
    }[aspectRatio] || [1024, 1024];

    try {
      let taskId = "";
      if (refImage) {
        // Multipart auto generation
        const fd = new FormData();
        fd.append("prompt", prompt);
        if (negativePrompt) fd.append("negative_prompt", negativePrompt);
        fd.append("width", String(dims[0]));
        fd.append("height", String(dims[1]));
        fd.append("seed", String(seed));
        fd.append("image", refImage);
        const res = await generateAuto(fd);
        taskId = res.task_id;
      } else {
        const res = await generate({
          prompt,
          negative_prompt: negativePrompt,
          workflow: model,
          steps,
          cfg,
          width: dims[0],
          height: dims[1],
          seed,
        });
        taskId = res.task_id;
      }

      setStatusText("ComfyUI 正在运算中...");

      subscribeTaskStream(taskId, (t: TaskResponse) => {
        setProgress(t.progress);
        if (t.status === "running") {
          setStatusText(`GPU 运算渲染中 (${t.progress}%)...`);
        } else if (t.status === "done") {
          setLoading(false);
          setStatusText("✓ 渲染完成");
          setResultImages(t.images || []);
        } else if (t.status === "failed") {
          setLoading(false);
          setError(t.error || "生成失败");
        }
      });
    } catch (e: any) {
      setLoading(false);
      setError(e.message || "请求失败");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">⚡ 快速工位 (Quick Studio)</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
            Single-Job Workbench
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          直观的图形化操作工位 · 适合精细化调参与快速出图测试
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Controls Panel (col-span-5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
          
          {/* Model Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">模型引擎 / 工作流</label>
            <div className="space-y-2">
              {MODEL_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleModelChange(opt.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    model === opt.id
                      ? "border-slate-900 bg-slate-50 shadow-2xs"
                      : "border-slate-200/80 hover:border-slate-300 bg-white"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    opt.type === "video" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {opt.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">正面提示词 (Prompt)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="输入画面的详细描述（英文或中文均可）..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all leading-relaxed"
            />
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">画幅比例</label>
            <div className="grid grid-cols-4 gap-2">
              {["1:1", "16:9", "9:16", "4:3"].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                    aspectRatio === ratio
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Image */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">参考图 / 首帧锚定 (可选)</label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />
            {refImagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black max-h-32 flex items-center justify-center">
                <img src={refImagePreview} alt="Ref Preview" className="max-h-32 object-contain" />
                <button
                  onClick={() => {
                    setRefImage(null);
                    setRefImagePreview("");
                  }}
                  className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-bold hover:bg-black"
                >
                  ✕ 移除
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-900 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-50/50 hover:bg-slate-100/50 transition-all cursor-pointer"
              >
                + 上传参考图或图生视频首帧
              </button>
            )}
          </div>

          {/* Pro Mode Collapsible */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowPro(!showPro)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-600 hover:text-slate-900 py-1"
            >
              <span>⚙️ 专家参数调节 (Pro Controls)</span>
              <span>{showPro ? "▲ 折叠" : "▼ 展开"}</span>
            </button>

            {showPro && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">负向提示词 (Negative Prompt)</label>
                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="blurry, low quality, deformed..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Steps ({steps})</label>
                    <input
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">CFG ({cfg})</label>
                    <input
                      type="number"
                      step="0.5"
                      value={cfg}
                      onChange={(e) => setCfg(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Seed (-1随机)</label>
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className={`w-full py-3.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${
              loading || !prompt.trim()
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95 shadow-xs"
            }`}
          >
            {loading ? "⌛ 渲染中..." : "✦ 立即开始生成"}
          </button>
        </div>

        {/* Right: Live Canvas (col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between min-h-[580px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">创作画布</h2>
              {loading && (
                <span className="text-xs font-semibold text-slate-700 animate-pulse">{statusText}</span>
              )}
            </div>

            {/* Progress Bar */}
            {loading && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4 overflow-hidden">
                <div
                  className="bg-slate-900 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* Result Display */}
            {resultImages.length > 0 ? (
              <div className="space-y-4">
                {resultImages.map((src, i) => {
                  const fullUrl = resolveImageUrl(src);
                  const isVideo = /\.(mp4|webm)$/i.test(src);
                  return (
                    <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-black">
                      {isVideo ? (
                        <video src={fullUrl} controls playsInline autoPlay muted loop className="w-full max-h-[480px] object-contain mx-auto" />
                      ) : (
                        <img src={fullUrl} alt="Generated" className="w-full max-h-[480px] object-contain mx-auto" />
                      )}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-mono">{src}</span>
                        <a
                          href={fullUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-black transition-colors"
                        >
                          ⬇ 下载原片
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !loading ? (
              <div className="h-96 rounded-xl bg-slate-50/50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-2">
                <span className="text-4xl">✦</span>
                <p className="text-xs font-semibold text-slate-400">准备就绪，点击左侧开始生成</p>
              </div>
            ) : (
              <div className="h-96 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-700 animate-pulse">{statusText}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                <strong>生成出错:</strong> {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
