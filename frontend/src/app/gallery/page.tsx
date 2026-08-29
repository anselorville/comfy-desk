"use client";

import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { fetchArtifacts, Artifact } from "../../lib/api";

export default function GalleryPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [filter, setFilter] = useState<"all" | "video" | "image">("all");
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  useEffect(() => {
    loadArtifacts();
  }, []);

  const loadArtifacts = async () => {
    setLoading(true);
    try {
      const res = await fetchArtifacts("done", 100);
      setArtifacts(res.artifacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Flatten images/videos from artifacts
  const mediaItems = artifacts.flatMap((art) => {
    return (art.images || []).map((img) => {
      const isVideo = /\.(mp4|webm)$/i.test(img);
      return {
        src: `/images/${img}`,
        filename: img,
        isVideo,
        prompt: art.prompt,
        workflow: art.workflow || "ComfyUI",
        createdAt: art.created_at,
        id: art.id,
      };
    });
  });

  const filteredItems = mediaItems.filter((item) => {
    if (filter === "video") return item.isVideo;
    if (filter === "image") return !item.isVideo;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900">🖼️ 多媒体创作画廊 (Gallery)</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
              {filteredItems.length} 件作品
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            浏览所有由智能助理、导演分镜与快速工位渲染生成的全分辨率图像与视频作品
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {(["all", "video", "image"] as const).map((f) => {
            const labels = { all: "全部作品", video: "🎬 仅视频", image: "🖼️ 仅图像" };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filter === f
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="h-72 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 gap-3">
          <div className="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="text-xs font-semibold">正在载入画廊作品...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="h-80 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-2">
          <span className="text-5xl">▦</span>
          <p className="text-sm font-semibold text-slate-500">暂无作品</p>
          <p className="text-xs text-slate-400">在智能创作或导演分镜页面生成你的第一个作品吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map((item, idx) => (
            <div
              key={idx}
              className="group bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              {/* Media Preview Box */}
              <div
                onClick={() => setLightboxIndex(idx)}
                className="relative aspect-square bg-black overflow-hidden cursor-pointer flex items-center justify-center"
              >
                {item.isVideo ? (
                  <video
                    src={item.src}
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <img
                    src={item.src}
                    alt={item.prompt || "Artwork"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}

                {/* Badge Overlay */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur">
                    {item.isVideo ? "🎬 VIDEO" : "🖼️ IMAGE"}
                  </span>
                </div>

                {/* Lightbox hover prompt */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs font-bold text-white px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur border border-white/30">
                    🔍 点击查看原片
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-3.5 space-y-2">
                <p className="text-xs text-slate-700 line-clamp-2 font-medium leading-relaxed">
                  {item.prompt || "无描述提示词"}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400 font-mono truncate max-w-[120px]">{item.workflow}</span>
                  <a
                    href={item.src}
                    download
                    className="font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    ⬇ 下载
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={filteredItems.map((item) => ({
          src: item.src,
        }))}
      />
    </div>
  );
}
