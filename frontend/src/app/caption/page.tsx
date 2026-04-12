"use client";

import { useState, useCallback, useRef } from "react";
import { captionImage, type CaptionResponse } from "@/lib/api";

const STYLES = [
  { id: "tags", label: "SD Tags", desc: "逗号标签，适合训练" },
  { id: "descriptive", label: "描述性", desc: "自然语言，详细描述" },
  { id: "short", label: "简短", desc: "一句话摘要" },
  { id: "training", label: "训练格式", desc: "优化的训练 prompt" },
];

export default function CaptionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [style, setStyle] = useState("tags");
  const [temperature, setTemperature] = useState(0.7);
  const [result, setResult] = useState<CaptionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  const handleCaption = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await captionImage(file, style, temperature);
      setResult(res);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [file, style, temperature]);

  const copy = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        style={{
          margin: "0 0 2rem",
          fontSize: "1.5rem",
          fontWeight: 700,
          background: "linear-gradient(135deg, #f1f1f6, #a855f7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        JoyCaption 智能标注
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
          alignItems: "start",
        }}
        className="caption-grid"
      >
        {/* Upload area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div
            id="drop-zone"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              minHeight: 280,
              borderRadius: 16,
              border: `2px dashed ${preview ? "rgba(124,58,237,0.5)" : "var(--border)"}`,
              background: preview ? "var(--bg-card)" : "var(--bg-surface)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transition: "all 0.2s ease",
              position: "relative",
            }}
          >
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={preview}
                alt="Preview"
                id="caption-preview"
                style={{ width: "100%", maxHeight: 400, objectFit: "contain" }}
              />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                <p style={{ fontSize: "2.5rem", margin: "0 0 0.75rem" }}>◈</p>
                <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>拖拽图片到此处</p>
                <p style={{ margin: 0, fontSize: "0.8rem" }}>或点击选择文件（PNG/JPG/WEBP）</p>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {/* Style selector */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "1.25rem",
            }}
          >
            <p
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Caption 风格
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  id={`style-${s.id}`}
                  onClick={() => setStyle(s.id)}
                  style={{
                    padding: "0.6rem 0.875rem",
                    borderRadius: 10,
                    border:
                      style === s.id
                        ? "1px solid rgba(124,58,237,0.5)"
                        : "1px solid var(--border)",
                    background:
                      style === s.id ? "rgba(124,58,237,0.15)" : "var(--bg-surface)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: style === s.id ? "#a855f7" : "var(--text-primary)",
                    }}
                  >
                    {s.label}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>

            <p
              style={{
                margin: "1rem 0 0.4rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              随机度 (Temperature)：{temperature.toFixed(2)}
            </p>
            <input
              id="temperature-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(+e.target.value)}
              style={{ width: "100%", cursor: "pointer", accentColor: "#7c3aed" }}
            />
          </div>

          <button
            id="caption-btn"
            onClick={handleCaption}
            disabled={loading || !file}
            style={{
              padding: "0.875rem",
              borderRadius: 12,
              border: "none",
              cursor: loading || !file ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: 700,
              background:
                loading || !file
                  ? "rgba(124,58,237,0.3)"
                  : "linear-gradient(135deg, #7c3aed, #a855f7)",
              color: "#fff",
              opacity: loading || !file ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow:
                loading || !file ? "none" : "0 0 30px rgba(124,58,237,0.35)",
            }}
          >
            {loading ? "⏳ 正在分析..." : "◈ 生成 Caption"}
          </button>
        </div>

        {/* Result panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            标注结果
          </h2>

          {result ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(124,58,237,0.3)",
                borderRadius: 16,
                padding: "1.25rem",
                boxShadow: "0 0 30px rgba(124,58,237,0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.875rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(124,58,237,0.2)",
                    color: "#a855f7",
                    fontWeight: 600,
                  }}
                >
                  {STYLES.find((s) => s.id === result.style)?.label ?? result.style}
                </span>
                <button
                  id="copy-btn"
                  onClick={copy}
                  style={{
                    padding: "0.3rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: copied ? "var(--success)" : "var(--text-muted)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {copied ? "✓ 已复制" : "复制"}
                </button>
              </div>

              <p
                id="caption-result"
                style={{
                  margin: 0,
                  lineHeight: 1.75,
                  fontSize: "0.9rem",
                  color: "var(--text-primary)",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {result.caption}
              </p>
            </div>
          ) : (
            <div
              style={{
                minHeight: 300,
                borderRadius: 16,
                border: "2px dashed var(--border)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>◈</span>
              <p style={{ margin: 0, fontSize: "0.875rem" }}>
                {loading ? "JoyCaption 正在分析图片..." : "上传图片后点击生成 Caption"}
              </p>
            </div>
          )}

          {result && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "1rem 1.25rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                💡 将此 caption 复制后可直接用于：
                <br />• 文生图正向提示词
                <br />• LoRA 训练数据集标注（.txt 文件）
                <br />• 数据集批量标注脚本
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .caption-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
