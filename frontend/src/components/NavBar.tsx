"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { fetchGpuTelemetry, cleanupGpu, GpuTelemetry } from "../lib/api";

const NAV_LINKS = [
  { href: "/", label: "AI 助理", icon: "✦" },
  { href: "/director", label: "导演分镜", icon: "🎬" },
  { href: "/studio", label: "快速工位", icon: "⚡" },
  { href: "/gallery", label: "媒体画廊", icon: "▦" },
  { href: "/a2a", label: "A2A 接入", icon: "🔌" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname?.startsWith("/m")) return null;

  const [gpu, setGpu] = useState<GpuTelemetry | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [showGpuMenu, setShowGpuMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateGpu = async () => {
      try {
        const tele = await fetchGpuTelemetry();
        setGpu(tele);
      } catch (e) {}
    };
    updateGpu();
    const interval = setInterval(updateGpu, 3000);
    return () => clearInterval(interval);
  }, []);

  // Close GPU dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowGpuMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCleanGpu = async () => {
    setCleaning(true);
    try {
      const res = await cleanupGpu();
      setGpu(res.gpu);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setCleaning(false), 500);
    }
  };

  const vramUsedGb = gpu ? (gpu.used_mb / 1024).toFixed(1) : "0.0";
  const vramTotalGb = gpu ? (gpu.total_mb / 1024).toFixed(0) : "22";
  const vramPct = gpu && gpu.total_mb > 0 ? Math.round((gpu.used_mb / gpu.total_mb) * 100) : 0;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/70 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Minimalist Brand Identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xs group-hover:scale-105 transition-transform duration-200">
              ✦
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                ComfyDesk
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                OS
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Clean Segmented Navigation Control */}
        <nav className="hidden md:flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-2xs">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  active
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <span className="text-[11px] opacity-70">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Hardware Telemetry Popover & Secondary Actions */}
        <div className="flex items-center gap-3">
          
          {/* Discreet Hardware Status Pill */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowGpuMenu(!showGpuMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-medium text-slate-700 transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono text-[11px] text-slate-600">2080Ti · {vramUsedGb}G/{vramTotalGb}G</span>
              <span className="text-[10px] text-slate-400">▾</span>
            </button>

            {/* Dropdown Popover */}
            {showGpuMenu && gpu && (
              <div className="absolute right-0 mt-2 w-64 p-4 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{gpu.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">Turing Architecture · 22GB Mod</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {gpu.temperature_c}°C
                  </span>
                </div>

                {/* VRAM Progress */}
                <div className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">显存已用 (VRAM)</span>
                    <span className="font-mono font-semibold text-slate-800">{vramUsedGb} GB / {vramTotalGb} GB ({vramPct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        vramPct > 80 ? "bg-amber-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${vramPct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Flush Action */}
                <button
                  onClick={handleCleanGpu}
                  disabled={cleaning}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🧹</span>
                  <span>{cleaning ? "正在释放显存..." : "卸载模型并释放显存"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          {/* Quick link to Mobile or Engine */}
          <Link
            href="/m"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span>📱</span>
            <span className="hidden sm:inline">手机端</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
