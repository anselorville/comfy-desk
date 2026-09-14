"use client";

import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { fetchArtifacts, deleteArtifacts, Artifact, resolveImageUrl } from "../../lib/api";

interface MediaItem {
  src: string;
  filename: string;
  isVideo: boolean;
  prompt: string;
  workflow: string;
  createdAt: string;
  id: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  filenames: string[];
  ids: string[];
  previewSrc?: string;
  isVideo?: boolean;
}

export default function GalleryPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [filter, setFilter] = useState<"all" | "video" | "image">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection & deletion state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFilenames, setSelectedFilenames] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Custom in-app confirmation modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Custom in-app toast message
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Preview & modal state
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [activeVideoItem, setActiveVideoItem] = useState<MediaItem | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    loadArtifacts();
  }, []);

  const loadArtifacts = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetchArtifacts("done", 100);
      setArtifacts(res.artifacts || []);
      // Clear missing selections
      setSelectedFilenames((prev) => {
        const available = new Set(
          (res.artifacts || []).flatMap((a) => a.images || [])
        );
        const next = new Set<string>();
        prev.forEach((fn) => {
          if (available.has(fn)) next.add(fn);
        });
        return next;
      });
      if (isRefresh) {
        showToast("画廊作品已刷新", "success");
      }
    } catch (e: any) {
      showToast(`加载画廊失败: ${e.message}`, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Flatten images/videos from artifacts
  const mediaItems: MediaItem[] = artifacts.flatMap((art) => {
    return (art.images || []).map((img) => {
      const isVideo = /\.(mp4|webm)$/i.test(img);
      const fullSrc = resolveImageUrl(img);
      return {
        src: fullSrc,
        filename: img,
        isVideo,
        prompt: art.prompt || "无描述提示词",
        workflow: art.workflow || "ComfyUI",
        createdAt: art.created_at || "",
        id: art.id,
      };
    });
  });

  const filteredItems = mediaItems.filter((item) => {
    if (filter === "video") return item.isVideo;
    if (filter === "image") return !item.isVideo;
    return true;
  });

  const toggleSelect = (filename: string) => {
    setSelectedFilenames((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allFiltered = new Set(filteredItems.map((i) => i.filename));
    setSelectedFilenames(allFiltered);
  };

  const deselectAll = () => {
    setSelectedFilenames(new Set());
  };

  // Trigger batch delete modal
  const openBatchDeleteModal = () => {
    if (selectedFilenames.size === 0) return;
    const filenames = Array.from(selectedFilenames);
    setConfirmModal({
      isOpen: true,
      title: `确认批量删除选中的 ${filenames.length} 件作品`,
      filenames,
      ids: [],
    });
  };

  // Trigger single item delete modal
  const openSingleDeleteModal = (item: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: `确认删除作品: ${item.filename}`,
      filenames: [item.filename],
      ids: [item.id],
      previewSrc: item.src,
      isVideo: item.isVideo,
    });
  };

  // Execute deletion confirmed by user in custom modal
  const handleConfirmDelete = async () => {
    if (!confirmModal) return;
    setDeleting(true);

    try {
      const res = await deleteArtifacts(confirmModal.filenames, confirmModal.ids);
      showToast(`已成功删除 ${res.deleted_count || confirmModal.filenames.length} 件作品`, "success");
      
      // Clean selection
      setSelectedFilenames((prev) => {
        const next = new Set(prev);
        confirmModal.filenames.forEach((fn) => next.delete(fn));
        return next;
      });
      setConfirmModal(null);
      await loadArtifacts(false);
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCardClick = (item: MediaItem, idx: number) => {
    if (selectMode) {
      toggleSelect(item.filename);
      return;
    }
    if (item.isVideo) {
      setActiveVideoItem(item);
    } else {
      setLightboxIndex(idx);
    }
  };

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header & Filter / Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 p-4 rounded-2xl border border-slate-200/70 shadow-2xs backdrop-blur-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">🖼️ 多媒体创作画廊</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-semibold shadow-2xs">
              {filteredItems.length} 件作品
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            浏览与管理所有由智能助理、导演分镜与快速工位渲染生成的全分辨率图像与视频成片
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => loadArtifacts(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="刷新画廊作品列表"
          >
            <span className={`text-sm ${refreshing ? "animate-spin" : ""}`}>🔄</span>
            <span>{refreshing ? "刷新中..." : "刷新"}</span>
          </button>

          {/* Filters */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            {(["all", "video", "image"] as const).map((f) => {
              const labels = { all: "全部", video: "🎬 视频", image: "🖼️ 图像" };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filter === f
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          {/* Multi-Select Toggle */}
          <button
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) setSelectedFilenames(new Set());
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
              selectMode
                ? "bg-indigo-600 text-white shadow-indigo-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <span>{selectMode ? "✓ 选择中" : "☑️ 批量管理"}</span>
          </button>
        </div>
      </div>

      {/* Batch Action Floating / Fixed Bar when select mode is active */}
      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/90 border border-indigo-200/80 rounded-2xl shadow-sm text-xs text-indigo-950 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="font-bold text-indigo-900">
              已勾选 <span className="font-mono text-sm px-1.5 py-0.5 rounded-md bg-white border border-indigo-200 font-bold text-indigo-600">{selectedFilenames.size}</span> 项
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={selectAll}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 cursor-pointer"
              >
                全选当前
              </button>
              <button
                onClick={deselectAll}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 cursor-pointer"
              >
                取消全选
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openBatchDeleteModal}
              disabled={selectedFilenames.size === 0 || deleting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>🗑️</span>
              <span>{deleting ? "正在处理..." : `批量删除 (${selectedFilenames.size})`}</span>
            </button>
            <button
              onClick={() => {
                setSelectMode(false);
                setSelectedFilenames(new Set());
              }}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold cursor-pointer"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* Media Grid */}
      {loading ? (
        <div className="h-72 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 gap-3 shadow-2xs">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
          <span className="text-xs font-semibold">正在载入画廊作品...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="h-80 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2.5 shadow-2xs">
          <span className="text-5xl opacity-60">▦</span>
          <p className="text-sm font-bold text-slate-700">暂无符合条件的作品</p>
          <p className="text-xs text-slate-400">在智能创作、导演分镜或快速工位生成你的首部作品吧！</p>
          <button
            onClick={() => loadArtifacts(true)}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            🔄 重新检测作品
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map((item, idx) => {
            const isSelected = selectedFilenames.has(item.filename);

            return (
              <div
                key={`${item.filename}-${idx}`}
                onClick={() => handleCardClick(item, idx)}
                className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 ring-2 ring-indigo-500/30 shadow-md bg-indigo-50/20"
                    : "border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-md"
                }`}
              >
                {/* Media Preview Box */}
                <div className="relative aspect-square bg-slate-950 overflow-hidden flex items-center justify-center">
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
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Top Left Badge */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-black/70 text-white backdrop-blur shadow-2xs">
                      {item.isVideo ? "🎬 视频" : "🖼️ 图像"}
                    </span>
                  </div>

                  {/* Top Right Actions: Checkbox or Delete Icon */}
                  <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                    {selectMode ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.filename);
                        }}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-md ${
                          isSelected
                            ? "bg-indigo-600 text-white ring-2 ring-white"
                            : "bg-black/60 text-transparent border border-white/50 hover:border-white"
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">✓</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => openSingleDeleteModal(item, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/70 hover:bg-red-600 text-white text-xs backdrop-blur transition-all duration-150 shadow-md cursor-pointer"
                        title="删除此作品"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {/* Hover Overlay */}
                  {!selectMode && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs font-bold text-white px-3.5 py-1.5 rounded-xl bg-white/20 backdrop-blur border border-white/30 shadow-lg">
                        {item.isVideo ? "▶ 播放视频" : "🔍 放大查看"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="p-3.5 space-y-2">
                  <p className="text-xs text-slate-700 line-clamp-2 font-medium leading-relaxed" title={item.prompt}>
                    {item.prompt}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400 font-mono truncate max-w-[130px]" title={item.workflow}>
                      {item.workflow}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={item.src}
                        download={item.filename}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-indigo-600 hover:text-indigo-800 text-[11px] flex items-center gap-0.5"
                      >
                        <span>⬇</span>
                        <span>下载</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Lightbox Modal */}
      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={filteredItems.map((item) => ({
          src: item.src,
        }))}
      />

      {/* Video Modal Player */}
      {activeVideoItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveVideoItem(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">🎬 视频原片预览</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {activeVideoItem.filename}
                </span>
              </div>
              <button
                onClick={() => setActiveVideoItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                src={activeVideoItem.src}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Footer / Info */}
            <div className="p-4 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
              <p className="line-clamp-2 max-w-xl text-slate-300 font-medium">
                {activeVideoItem.prompt}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={activeVideoItem.src}
                  download={activeVideoItem.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>⬇</span>
                  <span>下载高清视频</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom In-App Deletion Confirmation Modal (No Browser Alerts!) ── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !deleting && setConfirmModal(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Badge & Icon */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 text-xl font-bold shadow-2xs">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {confirmModal.filenames.length > 1 ? "确认批量删除作品" : "确认删除该作品"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  将永久清理所选的 {confirmModal.filenames.length} 项成果
                </p>
              </div>
            </div>

            {/* Preview Box if Single Item */}
            {confirmModal.previewSrc && (
              <div className="rounded-2xl overflow-hidden aspect-video bg-slate-950 border border-slate-200 flex items-center justify-center relative">
                {confirmModal.isVideo ? (
                  <video src={confirmModal.previewSrc} muted className="w-full h-full object-cover" />
                ) : (
                  <img src={confirmModal.previewSrc} alt="" className="w-full h-full object-cover" />
                )}
                <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/70 text-white backdrop-blur">
                  {confirmModal.filenames[0]}
                </span>
              </div>
            )}

            {/* Warning Message */}
            <div className="p-3.5 rounded-2xl bg-red-50/70 border border-red-100 text-xs text-red-800 leading-relaxed">
              ⚠️ <span className="font-semibold">此操作不可撤销：</span>
              文件将从服务器本地磁盘（<code className="font-mono text-[11px] bg-red-100/70 px-1 py-0.5 rounded">comfy-ui/output/</code>）彻底永久删除，并同步抹除任务记录。
            </div>

            {/* File List Summary if Multiple */}
            {confirmModal.filenames.length > 1 && (
              <div className="max-h-28 overflow-y-auto custom-scrollbar p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] font-mono text-slate-600 space-y-1">
                {confirmModal.filenames.map((fn, i) => (
                  <div key={i} className="truncate">
                    • {fn}
                  </div>
                ))}
              </div>
            )}

            {/* Dialog Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer shadow-md shadow-red-100 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>正在清理磁盘...</span>
                  </>
                ) : (
                  <>
                    <span>确认永久删除</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom In-App Floating Toast Notification ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[110] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-800 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          <span className="tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

