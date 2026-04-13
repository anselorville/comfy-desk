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
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px] border border-slate-800">
      <div className="bg-slate-800/50 backdrop-blur px-4 py-3 border-b border-white/5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/30"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/30"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"></div>
            </div>
            <span className="ml-2">Console v2.1 — Log Stream</span>
        </div>
        {error && <span className="text-rose-400 font-bold lowercase tracking-normal">{error}</span>}
      </div>
      <div className="flex-1 p-5 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed selection:bg-indigo-500/30">
        <div className="flex flex-col gap-1">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
                <div className="w-12 h-12 border-2 border-dashed border-white rounded-full animate-spin-slow"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Awaiting sub-process lifecycle</span>
            </div>
          ) : null}
          {logs.map((L, i) => (
            <div key={i} className="flex gap-3 group">
                <span className="text-slate-600 select-none w-8 text-right shrink-0">{i + 1}</span>
                <span className="text-slate-300 break-all">{L}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
