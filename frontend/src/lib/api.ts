/*
 * Dynamic API Base Resolution:
 * - Direct dev access on :3000 -> gateway at <host>:8001/api/v1
 * - Production / Reverse Proxy -> same-origin /api/v1
 */
function resolveApiBase(): string {
  if (typeof window === "undefined") return "http://localhost:8001/api/v1";
  const loc = window.location;
  if (loc.port === "3000") {
    return `${loc.protocol}//${loc.hostname}:8001/api/v1`;
  }
  return "/api/v1";
}

export const API_BASE = resolveApiBase();

export function resolveImageUrl(filename: string): string {
  if (!filename) return "";
  if (filename.startsWith("http://") || filename.startsWith("https://") || filename.startsWith("data:")) {
    return filename;
  }
  let clean = filename;
  while (clean.startsWith("/images/")) {
    clean = clean.slice(8);
  }
  clean = clean.replace(/^\/+/, "");
  
  if (typeof window !== "undefined") {
    const loc = window.location;
    if (loc.port === "3000") {
      return `${loc.protocol}//${loc.hostname}:8001/images/${clean}`;
    }
  }
  return `/images/${clean}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GpuTelemetry {
  available: boolean;
  name: string;
  total_mb: number;
  used_mb: number;
  free_mb: number;
  utilization_pct: number;
  temperature_c: number;
  power_w: number;
}

export interface TaskResponse {
  task_id: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  images: string[];
  error: string | null;
}

export interface Artifact {
  id: string;
  status: string;
  created_at: string;
  images: string[];
  error: string | null;
  kind: string;
  skill?: string;
  workflow?: string;
  prompt: string;
  params: Record<string, any>;
}

export interface StoryboardShot {
  id: string;
  shot_number: number;
  title: string;
  shot_type: string;
  camera_movement: string;
  scene_description: string;
  prompt: string;
  negative_prompt?: string;
  engine: string;
  status: "pending" | "rendering" | "done" | "failed";
  progress: number;
  keyframe_url: string;
  video_url: string;
  task_id: string;
  duration_sec: number;
  error?: string;
}

export interface Storyboard {
  id: string;
  title: string;
  synopsis: string;
  style: string;
  aspect_ratio: string;
  status: string;
  shots: StoryboardShot[];
  created_at: string;
  updated_at: string;
}

export interface CameraPreset {
  id: string;
  label: string;
  prompt_tag: string;
}

export interface StylePreset {
  id: string;
  label: string;
  prompt_prefix: string;
}

export interface TravelCategory {
  id: string;
  name: string;
  icon: string;
}

export interface TravelScenario {
  id: string;
  category: string;
  label: string;
  description: string;
  camera_lens: string;
  film_stock: string;
  lighting: string;
  color_grade: string;
  aesthetic: string;
  denoise: number;
}

export interface A2AChatRequest {
  message: string;
  ref_image?: string;
  mode?: "auto" | "image" | "video" | "storyboard" | "retouch";
  aspect_ratio?: string;
  preview?: boolean;
}

export interface A2AChatResponse {
  reply: string;
  kind?: "image" | "video" | "storyboard";
  task_id?: string;
  workflow?: string;
  status?: string;
  storyboard?: Storyboard;
  poll_url?: string;
  stream_url?: string;
}

export interface GenerateRequest {
  prompt: string;
  negative_prompt?: string;
  workflow?: string;
  steps?: number;
  cfg?: number;
  denoise?: number;
  width?: number;
  height?: number;
  seed?: number;
  length?: number;
}

export interface CaptionResponse {
  caption: string;
  style: string;
}

export interface DatasetImage {
  id: string;
  filename: string;
  has_caption: boolean;
  size: number;
}

export interface WorkflowMeta {
  id: string;
  name: string;
  fields: { name: string; type: string; label: string; default: any }[];
}

// ── System & Telemetry APIs ───────────────────────────────────────────────────

export async function fetchSystemMode(): Promise<{ mode: string }> {
  try {
    const res = await fetch(`${API_BASE}/system/mode`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    return { mode: "idle" };
  }
}

export async function fetchGpuTelemetry(): Promise<GpuTelemetry> {
  try {
    const res = await fetch(`${API_BASE}/system/gpu`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    return {
      available: false,
      name: "GPU Standby",
      total_mb: 22528,
      used_mb: 0,
      free_mb: 22528,
      utilization_pct: 0,
      temperature_c: 0,
      power_w: 0,
    };
  }
}

export async function cleanupGpu(): Promise<{ success: boolean; gpu: GpuTelemetry }> {
  const res = await fetch(`${API_BASE}/system/gpu-cleanup`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Agent Copilot & A2A APIs ──────────────────────────────────────────────────

export async function sendAgentChat(req: A2AChatRequest): Promise<A2AChatResponse> {
  const res = await fetch(`${API_BASE}/a2a/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchA2ATools(): Promise<any> {
  const res = await fetch(`${API_BASE}/a2a/tools`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMcpManifest(): Promise<any> {
  const res = await fetch(`${API_BASE}/a2a/mcp`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Director & Storyboard APIs ────────────────────────────────────────────────

export async function fetchDirectorPresets(): Promise<{ camera_movements: CameraPreset[]; styles: StylePreset[] }> {
  const res = await fetch(`${API_BASE}/director/presets`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function planStoryboard(
  synopsis: string,
  style = "cinematic",
  num_shots = 3,
  aspect_ratio = "16:9"
): Promise<Storyboard> {
  const res = await fetch(`${API_BASE}/director/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ synopsis, style, num_shots, aspect_ratio }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listStoryboards(): Promise<Storyboard[]> {
  const res = await fetch(`${API_BASE}/director/storyboards`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStoryboard(sbId: string): Promise<Storyboard> {
  const res = await fetch(`${API_BASE}/director/storyboards/${sbId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function renderShot(sbId: string, shotId: string, preview = false): Promise<{ task_id: string; status: string; shot_id: string }> {
  const res = await fetch(`${API_BASE}/director/storyboards/${sbId}/shots/${shotId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preview }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Standard Generation & Task APIs ───────────────────────────────────────────

export async function generate(req: GenerateRequest): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateAuto(formData: FormData): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/generate/auto`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pollTask(taskId: string): Promise<TaskResponse> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function subscribeTaskStream(taskId: string, onProgress: (t: TaskResponse) => void): () => void {
  const es = new EventSource(`${API_BASE}/tasks/${taskId}/stream`);
  es.addEventListener("progress", (e) => {
    try {
      const task: TaskResponse = JSON.parse(e.data);
      onProgress(task);
      if (task.status === "done" || task.status === "failed") {
        es.close();
      }
    } catch (err) {}
  });
  es.addEventListener("error", () => {
    es.close();
  });
  return () => es.close();
}

export async function fetchArtifacts(status = "done", limit = 100): Promise<{ artifacts: Artifact[] }> {
  const res = await fetch(`${API_BASE}/artifacts?status=${status}&limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteArtifacts(filenames: string[], ids: string[] = []): Promise<{ success: boolean; deleted_count: number }> {
  const res = await fetch(`${API_BASE}/artifacts/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filenames, ids }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorkflows(): Promise<WorkflowMeta[]> {
  const res = await fetch(`${API_BASE}/workflows`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.workflows ?? [];
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

export async function fetchTravelScenarios(category: string = "all"): Promise<{
  categories: TravelCategory[];
  scenarios: TravelScenario[];
}> {
  const res = await fetch(`${API_BASE}/skills/travel-scenarios?category=${encodeURIComponent(category)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
