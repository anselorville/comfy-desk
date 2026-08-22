/*
 * Resolve at runtime so any LAN device can open the app:
 * - direct dev access on :3000 → gateway at <host>:8001
 * - through the HTTPS edge (:8443) → same-origin /api/v1
 * A build-time NEXT_PUBLIC_API_BASE would bake "localhost" into the bundle
 * and break every non-host device.
 */
function resolveApiBase(): string {
  if (typeof window === "undefined") return "/api/v1";
  const loc = window.location;
  return loc.port === "3000"
    ? `${loc.protocol}//${loc.hostname}:8001/api/v1`
    : "/api/v1";
}

export const API_BASE = resolveApiBase();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  prompt: string;
  negative_prompt?: string;
  workflow?: string;
  steps?: number;
  cfg?: number;
  width?: number;
  height?: number;
  seed?: number;
  lora?: string;
  lora_strength?: number;
}

export interface TaskResponse {
  task_id: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  images: string[];
  error: string | null;
}

export interface CaptionResponse {
  caption: string;
  style: string;
}

// ── API helpers ────────────────────────────────────────────────────────────────

export async function fetchSystemMode(): Promise<{ mode: string }> {
  try {
    const res = await fetch(`${API_BASE}/system/mode`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    return { mode: "idle" };
  }
}

export async function generate(req: GenerateRequest): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pollTask(taskId: string): Promise<TaskResponse> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function captionImage(
  file: File,
  style = "tags",
  temperature = 0.7
): Promise<CaptionResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("style", style);
  form.append("max_tokens", "512");
  form.append("temperature", String(temperature));
  const res = await fetch(`${API_BASE}/caption`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface WorkflowMeta {
  id: string;
  name: string;
  fields: { name: string; type: string; label: string; default: any }[];
}

export async function listWorkflows(): Promise<WorkflowMeta[]> {
  const res = await fetch(`${API_BASE}/workflows`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.workflows ?? [];
}

/** Poll until done/failed, calling onProgress each tick. */
export async function waitForTask(
  taskId: string,
  onProgress: (t: TaskResponse) => void
): Promise<TaskResponse> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`${API_BASE}/tasks/${taskId}/stream`);
    es.addEventListener("progress", (e) => {
      try {
        const task: TaskResponse = JSON.parse(e.data);
        onProgress(task);
        if (task.status === "done" || task.status === "failed") {
          es.close();
          resolve(task);
        }
      } catch (err) {}
    });
    es.addEventListener("error", (e) => {
      es.close();
      reject(new Error("Stream error"));
    });
  });
}

// ── Dataset & Training APIs ────────────────────────────────────────────────────

export interface DatasetImage {
  id: string;
  filename: string;
  has_caption: boolean;
  size: number;
}

export async function fetchDatasetImages(): Promise<DatasetImage[]> {
  const res = await fetch(`${API_BASE}/dataset/images`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCaption(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/dataset/images/${id}/caption`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).caption;
}

export async function updateCaption(id: string, caption: string): Promise<void> {
  const res = await fetch(`${API_BASE}/dataset/images/${id}/caption`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function startBatchCaption(imageIds: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/dataset/caption-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function startTraining(epochLimit: number, learningRate: number): Promise<void> {
  const res = await fetch(`${API_BASE}/training/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ epoch_limit: epochLimit, learning_rate: learningRate }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export interface AutoGenerateRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  image?: File;
}

export async function generateAuto(req: AutoGenerateRequest): Promise<{ task_id: string }> {
  const fd = new FormData();
  fd.append("prompt", req.prompt);
  if (req.negative_prompt) fd.append("negative_prompt", req.negative_prompt);
  if (req.width) fd.append("width", String(req.width));
  if (req.height) fd.append("height", String(req.height));
  if (req.seed !== undefined) fd.append("seed", String(req.seed));
  if (req.image) fd.append("image", req.image);
  const res = await fetch(`${API_BASE}/generate/auto`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
