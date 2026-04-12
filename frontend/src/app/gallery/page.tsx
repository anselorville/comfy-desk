"use client";

import { useEffect, useState } from "react";

interface GalleryImage {
  src: string;
  name: string;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch image list from Next.js API route
  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((data) => setImages(data.images ?? []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 700,
            background: "linear-gradient(135deg, #f1f1f6, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          生成画廊
        </h1>
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          {images.length} 张图片
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
          加载中...
        </div>
      ) : images.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            color: "var(--text-muted)",
            border: "2px dashed var(--border)",
            borderRadius: 16,
          }}
        >
          <p style={{ fontSize: "2.5rem", margin: "0 0 1rem" }}>▦</p>
          <p style={{ margin: 0 }}>还没有生成任何图片</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              id={`gallery-img-${idx}`}
              onClick={() => setSelected(img)}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--border)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)";
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 8px 30px rgba(124,58,237,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.name}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          id="lightbox"
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(12px)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
            padding: "2rem",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.src}
            alt={selected.name}
            id="lightbox-image"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: 16,
              boxShadow: "0 0 60px rgba(124,58,237,0.4)",
              objectFit: "contain",
            }}
          />
          <div style={{ display: "flex", gap: "1rem" }}>
            <a
              href={selected.src}
              download
              onClick={(e) => e.stopPropagation()}
              style={actionBtn}
            >
              ↓ 下载
            </a>
            <button
              onClick={() => setSelected(null)}
              style={{ ...actionBtn, background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.3)", cursor: "pointer" }}
            >
              ✕ 关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: "0.5rem 1.25rem",
  borderRadius: 10,
  background: "rgba(124,58,237,0.2)",
  border: "1px solid rgba(124,58,237,0.4)",
  color: "#fff",
  textDecoration: "none",
  fontSize: "0.875rem",
  fontWeight: 600,
};
