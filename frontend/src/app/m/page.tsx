"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* API 基址:经 HTTPS 边缘时同源相对路径;直连 :3000 开发时走网关绝对地址 */
function apiBase(): string {
  if (process.env.NEXT_PUBLIC_STUDIO_API) {
    return process.env.NEXT_PUBLIC_STUDIO_API.replace(/\/+$/, "");
  }
  const loc = window.location;
  return loc.port === "3000" ? `${loc.protocol}//${loc.hostname}:8001/api/v1` : "/api/v1";
}

function mediaOrigin(): string {
  if (process.env.NEXT_PUBLIC_STUDIO_API) {
    return process.env.NEXT_PUBLIC_STUDIO_API.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  }
  const loc = window.location;
  return loc.port === "3000" ? `${loc.protocol}//${loc.hostname}:8001` : "";
}

type Req = {
  id: string;
  message: string;
  ref_image: string;
  status: string;
  detail: string;
  progress: number;
  result_url: string;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  queued:    { label: "排队中",   cls: "bg-slate-100 text-slate-600" },
  thinking:  { label: "AI 规划中", cls: "bg-blue-50 text-blue-700 animate-pulse" },
  submitted: { label: "已提交",   cls: "bg-indigo-50 text-indigo-700" },
  running:   { label: "生成中",   cls: "bg-blue-100 text-blue-700" },
  done:      { label: "已完成",   cls: "bg-emerald-50 text-emerald-700" },
  failed:    { label: "失败",     cls: "bg-red-50 text-red-700" },
};

function resolveMedia(url: string): string {
  return /^https?:/.test(url) ? url : `${mediaOrigin()}${url}`;
}

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function StudioPage() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifOn, setNotifOn] = useState(false);
  const [connected, setConnected] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* SSE live feed */
  useEffect(() => {
    const es = new EventSource(`${apiBase()}/studio/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.type === "snapshot") {
        setRequests(evt.requests);
        return;
      }
      if (evt.type === "request") {
        setRequests((prev) => {
          const i = prev.findIndex((r) => r.id === evt.request.id);
          const next = i >= 0
            ? prev.map((r) => (r.id === evt.request.id ? evt.request : r))
            : [evt.request, ...prev];
          return [...next].sort((a, b) => b.created_at.localeCompare(a.created_at));
        });
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* service worker + resume notification state */
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (typeof Notification !== "undefined" && Notification.permission === "granted")
      setNotifOn(true);
  }, []);

  const submit = useCallback(async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("message", message.trim());
      fd.append("preview", String(preview));
      if (imageFile) fd.append("image", imageFile);
      const res = await fetch(`${apiBase()}/studio/requests`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText);
      setMessage("");
      setImageFile(null);
      setImageUrl("");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }, [message, imageFile, preview, submitting]);

  const enableNotifications = useCallback(async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      setNotifOn(true);
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch(`${apiBase()}/studio/push/vapid`).then((r) => r.json());
      let sub = await reg.pushManager.getSubscription();
      if (!sub)
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicKey),
        });
      await fetch(`${apiBase()}/studio/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch (err) {
      console.error("push subscribe failed", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickImage = useCallback((f: File | null) => {
    setImageFile(f);
    setImageUrl(f ? URL.createObjectURL(f) : "");
  }, []);

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      {/* header */}
      <header className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900">ComfyDesk</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold">
            Studio
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300 animate-pulse"}`}
            title={connected ? "实时连接" : "连接中"}
          />
          {!notifOn && (
            <button
              onClick={enableNotifications}
              className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
            >
              开启通知
            </button>
          )}
        </div>
      </header>

      {/* composer */}
      <section className="mt-4 bg-white ring-1 ring-slate-200 shadow-sm rounded-2xl p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">描述你想要的视频</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="例:让这个角色缓缓转头看向镜头,微笑,背景轻微虚化…"
          className="w-full text-sm rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none placeholder:text-slate-400"
        />
        <div className="flex items-center gap-3 mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            id="ref-image"
          />
          <label
            htmlFor="ref-image"
            className="text-xs px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer font-medium"
          >
            🖼 角色参考图
          </label>
          {imageUrl && (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="参考图" className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200" />
              <button
                onClick={() => pickImage(null)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] leading-none"
              >
                ✕
              </button>
            </span>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            快速预览
          </label>
        </div>
        <button
          onClick={submit}
          disabled={!message.trim() || submitting}
          className="mt-3 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {submitting ? "提交中…" : "生成视频"}
        </button>
      </section>

      {/* request list */}
      <section className="mt-6 space-y-4">
        {requests.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-10">还没有请求 · 在上方提交第一条</p>
        )}
        {requests.map((r) => {
          const meta = STATUS_META[r.status] ?? STATUS_META.queued;
          const busy = r.status === "thinking" || r.status === "running";
          const mediaSrc = r.result_url ? resolveMedia(r.result_url) : "";
          return (
            <article key={r.id} className="bg-white ring-1 ring-slate-200 shadow-sm rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                <time className="text-xs text-slate-400">{r.created_at.slice(5, 16).replace("T", " ")}</time>
              </div>
              <p className="text-sm text-slate-800">{r.message}</p>
              {(busy || (r.progress > 0 && r.status !== "done")) && (
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-[width] duration-300 ease-linear"
                    style={{ width: `${Math.max(r.progress, 4)}%` }}
                  />
                </div>
              )}
              {r.detail && (
                <p className={`mt-2 text-xs ${r.status === "failed" ? "text-red-600" : "text-slate-500"}`}>
                  {r.detail}
                </p>
              )}
              {r.ref_image && <p className="mt-1 text-xs text-slate-400">🖼 已附角色参考图</p>}
              {r.status === "done" && mediaSrc && (
                <div className="mt-3">
                  <video controls playsInline preload="metadata" src={mediaSrc} className="w-full rounded-xl bg-black" />
                  <a
                    href={mediaSrc}
                    download
                    className="mt-2 block text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                  >
                    ⬇ 下载视频
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
