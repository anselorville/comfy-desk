export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api/v1";

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
