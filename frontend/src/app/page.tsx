"use client";

import { useState, useCallback } from "react";
import {
  generate,
  waitForTask,
  listWorkflows,
  type TaskResponse,
} from "@/lib/api";

const PRESETS = [
  { label: "SDXL", value: "txt2img_sdxl" },
  { label: "Flux.1", value: "txt2img_flux" },
];

const ASPECT_RATIOS = [
  { label: "1:1 (1024)", w: 1024, h: 1024 },
  { label: "3:4 (768×1024)", w: 768, h: 1024 },
  { label: "4:3 (1024×768)", w: 1024, h: 768 },
  { label: "16:9 (1280×720)", w: 1280, h: 720 },
  { label: "9:16 (720×1280)", w: 720, h: 1280 },
];

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState(
    "blurry, low quality, watermark, text, signature"
  );
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
        }}
        className="generate-grid"
      >
        {/* ── Left panel: Controls ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
            文本生成图片
          </h1>

          {/* Prompt */}
          <Card>
            <Label>正向提示词</Label>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="a stunning portrait of a woman in a garden, golden hour, bokeh, photorealistic..."
              rows={4}
              style={textareaStyle}
            />
            <Label style={{ marginTop: "0.75rem" }}>负向提示词</Label>
            <textarea
              id="neg-prompt-input"
              value={negPrompt}
              onChange={(e) => setNegPrompt(e.target.value)}
              rows={2}
              style={{ ...textareaStyle, opacity: 0.75 }}
            />
          </Card>

          {/* Workflow */}
          <Card>
            <Label>生成模型</Label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  id={`workflow-${p.value}`}
                  onClick={() => setWorkflow(p.value)}
                  style={chipBtn(workflow === p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Label style={{ marginTop: "1rem" }}>画幅比例</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {ASPECT_RATIOS.map((a, i) => (
                <button
                  key={a.label}
                  id={`aspect-${i}`}
                  onClick={() => setAspectIdx(i)}
                  style={chipBtn(aspectIdx === i)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Parameters */}
          <Card>
            <Label>采样步数：{steps}</Label>
            <input
              id="steps-slider"
              type="range"
              min={10}
              max={100}
              value={steps}
              onChange={(e) => setSteps(+e.target.value)}
              style={sliderStyle}
            />
            <Label style={{ marginTop: "0.75rem" }}>引导系数(CFG)：{cfg.toFixed(1)}</Label>
            <input
              id="cfg-slider"
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={cfg}
              onChange={(e) => setCfg(+e.target.value)}
              style={sliderStyle}
            />
            <Label style={{ marginTop: "0.75rem" }}>Seed：</Label>
            <input
              id="seed-input"
              type="number"
              value={seed}
              onChange={(e) => setSeed(+e.target.value)}
              placeholder="-1 (随机)"
              style={inputStyle}
            />
          </Card>

          {/* LoRA */}
          <Card>
            <Label>LoRA（可选）</Label>
            <input
              id="lora-input"
              type="text"
              value={lora}
              onChange={(e) => setLora(e.target.value)}
              placeholder="my_lora（不含扩展名）"
              style={inputStyle}
            />
            <Label style={{ marginTop: "0.75rem" }}>LoRA 强度：{loraStrength.toFixed(2)}</Label>
            <input
              id="lora-strength-slider"
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={loraStrength}
              onChange={(e) => setLoraStrength(+e.target.value)}
              style={sliderStyle}
            />
          </Card>

          {/* Generate button */}
          <button
            id="generate-btn"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{
              padding: "0.875rem",
              borderRadius: 12,
              border: "none",
              cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              background:
                loading || !prompt.trim()
                  ? "rgba(124,58,237,0.3)"
                  : "linear-gradient(135deg, #7c3aed, #a855f7)",
              color: "#fff",
              opacity: loading || !prompt.trim() ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow: loading || !prompt.trim()
                ? "none"
                : "0 0 30px rgba(124,58,237,0.4)",
            }}
          >
            {loading ? "⏳ 生成中..." : "✦ 开始生成"}
          </button>
        </div>

        {/* ── Right panel: Output ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            输出结果
          </h2>

          {/* Progress */}
          {loading && (
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                  {status === "running" ? "渲染中..." : "排队中..."}
                </span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#a855f7" }}>
                  {progress}%
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                    transition: "width 0.4s ease",
                    borderRadius: 3,
                  }}
                />
              </div>
            </Card>
          )}

          {/* Result images */}
          {resultImages.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {resultImages.map((src, idx) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    boxShadow: "0 0 40px rgba(124,58,237,0.2)",
                    position: "relative",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Generated ${idx + 1}`}
                    id={`result-image-${idx}`}
                    style={{ width: "100%", display: "block" }}
                  />
                  <a
                    href={src}
                    download
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      padding: "0.4rem 0.875rem",
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.7)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    ↓ 下载
                  </a>
                </div>
              ))}
            </div>
          ) : !loading ? (
            <div
              style={{
                flex: 1,
                minHeight: 400,
                borderRadius: 16,
                border: "2px dashed var(--border)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                color: "var(--text-muted)",
              }}
            >
              <span style={{ fontSize: "3rem", opacity: 0.3 }}>✦</span>
              <p style={{ margin: 0, fontSize: "0.875rem" }}>
                在左侧输入提示词，点击开始生成
              </p>
            </div>
          ) : null}

          {task?.error && (
            <Card>
              <p style={{ margin: 0, color: "var(--error)", fontSize: "0.875rem" }}>
                ❌ 生成失败：{task.error}
              </p>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .generate-grid { grid-template-columns: 1fr !important; }
        }
        input[type=range] { accent-color: #7c3aed; }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.25rem",
      }}
    >
      {children}
    </div>
  );
}

function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        margin: "0 0 0.4rem",
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "0.75rem",
  color: "var(--text-primary)",
  fontSize: "0.9rem",
  lineHeight: 1.6,
  resize: "vertical",
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.15s",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "0.6rem 0.75rem",
  color: "var(--text-primary)",
  fontSize: "0.9rem",
  fontFamily: "inherit",
  outline: "none",
};

const sliderStyle: React.CSSProperties = {
  width: "100%",
  cursor: "pointer",
};

function chipBtn(active: boolean): React.CSSProperties {
  return {
    padding: "0.35rem 0.875rem",
    borderRadius: 8,
    border: active
      ? "1px solid rgba(124,58,237,0.5)"
      : "1px solid var(--border)",
    background: active ? "rgba(124,58,237,0.2)" : "var(--bg-surface)",
    color: active ? "#a855f7" : "var(--text-muted)",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };
}
