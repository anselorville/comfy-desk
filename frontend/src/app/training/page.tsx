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
    if (ids.length === 0) return alert("All images have captions!");
    try {
      await startBatchCaption(ids);
      alert(`Batch caption started for ${ids.length} images`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartTraining = async () => {
    try {
      await startTraining(epochs, lr);
      setSysMode("training");
    } catch (e: any) {
      alert("Failed to start training: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-purple-600 to-blue-500">
          LoRA 训练与数据集
        </h1>
        <p className="text-slate-500 mt-2">
          预处理数据集标注并一键启动基于 Kohya_ss 的微调。仅支持单卡排队系统，请确保当前非生成状态。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side - Dataset viewer */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">数据集预览</h2>
              <button
                onClick={handleBatchCaption}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors border border-slate-200"
              >
                一键补全缺失标注 (JoyCaption)
              </button>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className={`
                    relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-colors
                    ${selectedImage?.id === img.id ? "border-purple-500 shadow-md" : "border-slate-200 hover:border-slate-300"}
                  `}
                >
                  <span className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded-full bg-black/60 text-white font-mono z-10 backdrop-blur-sm">
                    {img.has_caption ? "TXT" : "NO"}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/dataset/${img.filename}`} // Needs static serving or bypass for real project, or API get
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.src = "")} // Handle static route mapping in nginx or fastapi
                  />
                  {!img.has_caption && (
                    <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />
                  )}
                </div>
              ))}
              {images.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  {process.env.NEXT_PUBLIC_DATASET_DIR || "/app/dataset"} 文件夹为空
                </div>
              )}
            </div>

            {selectedImage && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <label className="block text-sm font-semibold text-slate-600 mb-2">
                  编辑标注: {selectedImage.filename}.txt
                </label>
                <textarea
                  className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                />
                <div className="mt-2 text-right">
                  <button
                    onClick={handleSaveCaption}
                    disabled={savingCaption}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingCaption ? "保存中..." : "保存文本"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4">开启训练任务</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">训练轮数 (Epochs): {epochs}</label>
                <input
                  type="range" min="1" max="50" value={epochs}
                  onChange={(e) => setEpochs(+e.target.value)}
                  className="w-full accent-purple-600"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">学习率 (LR): {lr}</label>
                <select
                  value={lr} onChange={(e) => setLr(+e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                >
                  <option value={0.0001}>0.0001</option>
                  <option value={0.00005}>0.00005</option>
                  <option value={0.00001}>0.00001</option>
                </select>
              </div>
              <button
                onClick={handleStartTraining}
                disabled={images.length === 0 || sysMode !== "idle"}
                className="w-full py-3 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-50 mt-4 disabled:cursor-not-allowed"
              >
                {sysMode === "training" ? "⏳ 训练进行中..." : sysMode === "generating" ? "❌ AI 生成中，无法训练" : "▶ 开始 LoRA 模型训练"}
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Log stream */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px] flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-4">实时运行日志</h2>
          <div className="flex-1">
             {(sysMode === "training" || sysMode === "idle") ? <TrainingLogs /> : (
               <div className="h-full flex items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400">
                  <p>当前处于 {sysMode} 模式，无法查看训练日志</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
