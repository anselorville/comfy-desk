"use client";

import { useEffect, useState, useCallback } from "react";
import TrainingLogs from "@/components/TrainingLogs";
import {
  fetchDatasetImages,
  fetchCaption,
  updateCaption,
  startBatchCaption,
  startTraining,
  fetchSystemMode,
  type DatasetImage,
} from "@/lib/api";

export default function TrainingPage() {
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<DatasetImage | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  
  const [sysMode, setSysMode] = useState("idle");
  const [epochs, setEpochs] = useState(10);
  const [lr, setLr] = useState(0.0001);

  const loadImages = useCallback(async () => {
    try {
      const data = await fetchDatasetImages();
      setImages(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadImages();
    // System status polling for training
    const ival = setInterval(async () => {
      const { mode } = await fetchSystemMode();
      setSysMode(mode);
    }, 2000);
    return () => clearInterval(ival);
  }, [loadImages]);

  // Load a specific caption when an image is clicked
  useEffect(() => {
    if (!selectedImage) {
      setCaptionText("");
      return;
    }
    fetchCaption(selectedImage.id).then(txt => setCaptionText(txt)).catch(() => setCaptionText(""));
  }, [selectedImage]);

  const handleSaveCaption = async () => {
    if (!selectedImage) return;
    setSavingCaption(true);
    try {
      await updateCaption(selectedImage.id, captionText);
      await loadImages();
    } catch (e) {
      console.error(e);
    }
    setSavingCaption(false);
  };

  const handleBatchCaption = async () => {
    // Collect images with no caption text file
    const ids = images.filter((img) => !img.has_caption).map((i) => i.id);
    if (ids.length === 0) return alert("所有图片已完成标注！");
    try {
      await startBatchCaption(ids);
      alert(`已为 ${ids.length} 张图片启动批量标注`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartTraining = async () => {
    try {
      await startTraining(epochs, lr);
      setSysMode("training");
    } catch (e: any) {
      alert("启动训练失败: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
          LoRA 训练中心
        </h1>
        <p className="mt-2 text-slate-500 text-sm font-medium">
          管理您的数据集标注，一键开启模型微调。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side - Dataset viewer */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">数据集预览</h2>
              <button
                onClick={handleBatchCaption}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all border border-indigo-100"
              >
                批量标注 (JoyCaption)
              </button>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className={`
                    relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all
                    ${selectedImage?.id === img.id ? "border-indigo-500 ring-4 ring-indigo-500/10 shadow-sm scale-[0.98]" : "border-slate-100 hover:border-slate-200"}
                  `}
                >
                  <div className="absolute top-1 right-1 z-10">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-sm border ${
                      img.has_caption ? "bg-emerald-50/80 text-emerald-700 border-emerald-100" : "bg-amber-50/80 text-amber-700 border-amber-100"
                    }`}>
                      {img.has_caption ? "已标注" : "待标注"}
                    </span>
                  </div>
                  <img
                    src={`/images/${img.filename}`} 
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.src = "https://placehold.co/200x200?text=Error")}
                  />
                  {!img.has_caption && (
                    <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
                  )}
                </div>
              ))}
              {images.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">数据集为空</p>
                </div>
              )}
            </div>

            {selectedImage && (
              <div className="mt-6 pt-6 border-t border-slate-50">
                <div className="flex justify-between items-center mb-3">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    编辑标注: <span className="text-slate-600 font-black">{selectedImage.filename}</span>
                    </label>
                </div>
                <textarea
                  className="w-full h-28 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="在此输入图片描述..."
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleSaveCaption}
                    disabled={savingCaption}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-100 hover:shadow-lg disabled:opacity-50 uppercase tracking-widest"
                  >
                    {savingCaption ? "保存中..." : "应用更新"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6">训练配置</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      训练轮数 (Epochs)
                    </label>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {epochs}
                    </span>
                </div>
                <input
                  type="range" min="1" max="50" value={epochs}
                  onChange={(e) => setEpochs(+e.target.value)}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">学习率 (LR)</label>
                <select
                  value={lr} onChange={(e) => setLr(+e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none cursor-pointer focus:border-indigo-500 transition-all"
                >
                  <option value={0.0001}>0.0001 (推荐)</option>
                  <option value={0.00005}>0.00005</option>
                  <option value={0.00001}>0.00001</option>
                </select>
              </div>
              <button
                onClick={handleStartTraining}
                disabled={images.length === 0 || sysMode !== "idle"}
                className={`w-full py-4 rounded-xl text-sm font-black tracking-widest uppercase transition-all shadow-md active:scale-[0.98] ${
                  sysMode === "training" 
                    ? "bg-amber-50 text-amber-700 border border-amber-100 animate-pulse" 
                    : sysMode === "generating" 
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200"
                    : "bg-slate-900 text-white hover:bg-black shadow-slate-200"
                }`}
              >
                {sysMode === "training" ? "⌛ 训练进行中" : sysMode === "generating" ? "系统繁忙 (生成中)" : "▶ 开始 LoRA 模型训练"}
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Log stream */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">后台运行日志</h2>
            {sysMode === "training" && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">任务执行中</span>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex-1 flex flex-col min-h-[500px]">
             {(sysMode === "training" || sysMode === "idle") ? <TrainingLogs /> : (
               <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
                  <div className="text-4xl filter grayscale opacity-30">◈</div>
                  <p className="text-sm font-bold text-slate-400 leading-relaxed max-w-xs">
                    当前处于 <span className="text-indigo-600 uppercase">{sysMode}</span> 模式，请先完成当前任务以查看训练控制台。
                  </p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
