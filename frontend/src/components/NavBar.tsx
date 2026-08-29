"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchGpuTelemetry, cleanupGpu, GpuTelemetry } from "../lib/api";

const NAV_LINKS = [
  { href: "/", label: "AI 助理", icon: "✦", badge: "Agent" },
  { href: "/director", label: "导演分镜", icon: "🎬", badge: "Director" },
  { href: "/studio", label: "快速工位", icon: "⚡", badge: "Studio" },
  { href: "/gallery", label: "画廊", icon: "▦", badge: "" },
  { href: "/a2a", label: "A2A 接入", icon: "🔌", badge: "MCP" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname?.startsWith("/m")) return null;

  const [gpu, setGpu] = useState<GpuTelemetry | null>(null);
  const [cleaning, setCleaning] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 glass-nav border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand & GPU Pill */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">ComfyDesk</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Agent 2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">ComfyUI 智能创作工作台</p>
            </div>
          </Link>

          {/* Real-time Hardware Telemetry Pill */}
          {gpu && gpu.available && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-700">2080Ti (22GB)</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">{gpu.temperature_c}°C</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">显存 {(gpu.used_mb / 1024).toFixed(1)}G / {(gpu.total_mb / 1024).toFixed(1)}G</span>
              <button
                onClick={handleCleanGpu}
                title="卸载模型并释放显存"
                disabled={cleaning}
                className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer active:scale-95 transition-all"
              >
                {cleaning ? "释放中..." : "释放显存"}
              </button>
            </div>
          )}
        </div>

        {/* Center / Right: Navigation Links */}
        <div className="flex items-center gap-1.5">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
                {link.badge && !active && (
                  <span className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Mobile Switcher */}
          <Link
            href="/m"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all"
          >
            <span>📱</span>
            <span className="hidden md:inline">移动版</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
