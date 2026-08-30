"use client";

import { useState, useEffect } from "react";
import {
  planStoryboard,
  listStoryboards,
  renderShot,
  fetchDirectorPresets,
  Storyboard,
  CameraPreset,
  StylePreset,
  resolveImageUrl,
} from "../../lib/api";

export default function DirectorPage() {
  const [synopsis, setSynopsis] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [numShots, setNumShots] = useState(3);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const [presets, setPresets] = useState<{ camera_movements: CameraPreset[]; styles: StylePreset[] }>({
    camera_movements: [],
    styles: [],
  });

  const [currentStoryboard, setCurrentStoryboard] = useState<Storyboard | null>(null);
  const [savedStoryboards, setSavedStoryboards] = useState<Storyboard[]>([]);

  useEffect(() => {
    fetchDirectorPresets().then(setPresets).catch(console.error);
    loadSavedStoryboards();
  }, []);

  const loadSavedStoryboards = async () => {
    try {
      const list = await listStoryboards();
      setSavedStoryboards(list);
      if (list.length > 0 && !currentStoryboard) {
        setCurrentStoryboard(list[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlan = async () => {
    if (!synopsis.trim() || loading) return;
    setLoading(true);
    try {
      const sb = await planStoryboard(synopsis, style, numShots, aspectRatio);
      setCurrentStoryboard(sb);
      loadSavedStoryboards();
    } catch (e: any) {
      alert(`分镜构思失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenderShot = async (shotId: string) => {
    if (!currentStoryboard) return;
    try {
      await renderShot(currentStoryboard.id, shotId, preview);
      setCurrentStoryboard((prev) => {
        if (!prev) return prev;
        const updated = prev.shots.map((s) =>
          s.id === shotId ? { ...s, status: "rendering" as const, progress: 15 } : s
        );
        return { ...prev, shots: updated };
      });
    } catch (e: any) {
      alert(`渲染镜头失败: ${e.message}`);
    }
  };

  const handleRenderAllShots = async () => {
    if (!currentStoryboard) return;
    for (const shot of currentStoryboard.shots) {
      if (shot.status !== "done") {
        await handleRenderShot(shot.id);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">🎬 智能导演与分镜工作台</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              Director Studio
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            将故事剧本解构为多镜头分镜序列 · 指定专业镜头运镜与角色连续性 · 调度 MiniMax H3 与 Wan2.1 渲染全片
          </p>
        </div>
      </div>

      {/* Script & Planning Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">剧本构思与导演编排</h2>
          <span className="text-xs text-slate-400">Step 1: 输入剧本梗概</span>
        </div>

        {/* Textarea */}
        <div>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            rows={3}
            placeholder="例如：赛博朋克雨夜，探员在霓虹闪烁的窄巷中追查仿生人，镜头从全景推至中景交锋，最后特写眼神中的决绝..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all leading-relaxed"
          />
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Style Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">视觉画风</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 font-medium cursor-pointer"
            >
              {presets.styles.length > 0 ? (
                presets.styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))
              ) : (
                <>
                  <option value="cinematic">🎬 电影级写实 (Cinematic 8K)</option>
                  <option value="anime">🌸 新海诚动画 (Anime)</option>
                  <option value="cyberpunk">🌆 赛博朋克 (Cyberpunk)</option>
                  <option value="pixel_art">👾 复古像素 (Pixel Art)</option>
                  <option value="3d_render">🎨 3D皮克斯 (Pixar 3D)</option>
                </>
              )}
            </select>
          </div>

          {/* Shot Count */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">分镜镜头数量</label>
            <div className="flex items-center gap-2">
              {[3, 4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setNumShots(count)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    numShots === count
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                  }`}
                >
                  {count} 镜
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">画幅比例</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 font-medium cursor-pointer"
            >
              <option value="16:9">16:9 横屏电影</option>
              <option value="9:16">9:16 竖屏短视频</option>
              <option value="1:1">1:1 方形正交</option>
            </select>
          </div>

          {/* Action CTA */}
          <div className="flex flex-col justify-end">
            <button
              onClick={handlePlan}
              disabled={loading || !synopsis.trim()}
              className={`w-full py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                loading || !synopsis.trim()
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95 shadow-xs"
              }`}
            >
              {loading ? "🎬 智能构思中..." : "🎬 一键智能导演分镜 ✦"}
            </button>
          </div>
        </div>
      </div>

      {/* Storyboard Project View & Shot Timeline */}
      {currentStoryboard && (
        <div className="space-y-6">
          
          {/* Storyboard Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 text-white">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold font-mono">
                  {currentStoryboard.aspect_ratio}
                </span>
                <h3 className="text-base font-bold">{currentStoryboard.title}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{currentStoryboard.synopsis}</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preview}
                  onChange={(e) => setPreview(e.target.checked)}
                  className="rounded text-indigo-500"
                />
                <span>480P快速预览</span>
              </label>

              <button
                onClick={handleRenderAllShots}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                🎬 批量渲染全部镜头
              </button>
            </div>
          </div>

          {/* Shots Timeline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentStoryboard.shots.map((shot) => {
              const isRendering = shot.status === "rendering";

              return (
                <div
                  key={shot.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between"
                >
                  {/* Top Media / Player Area */}
                  <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                    {shot.video_url ? (
                      <video
                        src={resolveImageUrl(shot.video_url)}
                        controls
                        playsInline
                        loop
                        className="w-full h-full object-contain"
                      />
                    ) : isRendering ? (
                      <div className="flex flex-col items-center gap-2 p-4 text-center">
                        <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold text-slate-300">GPU 视频渲染中...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-600">
                        <span className="text-3xl opacity-40">🎬</span>
                        <span className="text-[11px] font-medium text-slate-400">待渲染镜头</span>
                      </div>
                    )}

                    {/* Badge on top left */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur border border-white/10">
                        SHOT #{shot.shot_number}
                      </span>
                    </div>

                    {/* Camera Badge top right */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-white backdrop-blur">
                        {shot.camera_movement}
                      </span>
                    </div>
                  </div>

                  {/* Shot Details Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-slate-900">{shot.title}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold">{shot.shot_type}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{shot.scene_description}</p>

                      {/* Prompt details drawer/snippet */}
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-500 font-mono line-clamp-2">
                        {shot.prompt}
                      </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {shot.engine.replace("video_", "").replace("_t2v", "").replace("_i2v", "")}
                      </span>

                      {shot.video_url ? (
                        <a
                          href={resolveImageUrl(shot.video_url)}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 hover:text-black bg-slate-100 transition-colors"
                        >
                          ⬇ 下载镜头
                        </a>
                      ) : (
                        <button
                          onClick={() => handleRenderShot(shot.id)}
                          disabled={isRendering}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isRendering
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-900 hover:bg-black text-white shadow-2xs cursor-pointer active:scale-95"
                          }`}
                        >
                          {isRendering ? "渲染中..." : "渲染此镜头 ✦"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Storyboards List */}
      {savedStoryboards.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">历史分镜项目 ({savedStoryboards.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedStoryboards.map((sb) => (
              <div
                key={sb.id}
                onClick={() => setCurrentStoryboard(sb)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  currentStoryboard?.id === sb.id
                    ? "border-slate-900 bg-slate-50 shadow-2xs"
                    : "border-slate-200/80 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-900">{sb.title}</h4>
                  <span className="text-[10px] text-slate-400">{sb.shots.length} 镜头</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{sb.synopsis}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
