"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function TrainingLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    
    // Slight delay to ensure the backend mode allows log streaming
    const t = setTimeout(() => {
      es = new EventSource(`${API_BASE}/training/logs`);
      es.addEventListener("log", (e) => {
        setLogs(prev => [...prev, e.data]);
      });
      es.addEventListener("error", () => {
        // SSE errors happen on disconnect. Wait and keep logs.
        setError("Disconnected from log stream");
        es?.close();
      });
    }, 500);

    return () => {
      clearTimeout(t);
      es?.close();
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex flex-col h-[500px]">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 font-semibold text-slate-300 text-xs uppercase tracking-wider flex justify-between items-center">
        <span>Kohya_ss Terminal Log</span>
        {error && <span className="text-red-400 font-normal normal-case">{error}</span>}
      </div>
      <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
        <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap flex flex-col gap-1">
          {logs.length === 0 ? <span className="opacity-50">Waiting for process logs...</span> : null}
          {logs.map((L, i) => (
            <span key={i}>{L}</span>
          ))}
        </pre>
      </div>
    </div>
  );
}
