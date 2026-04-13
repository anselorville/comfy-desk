"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSystemMode } from "../lib/api";

const links = [
  { href: "/", label: "生成", icon: "✦" },
  { href: "/gallery", label: "画廊", icon: "▦" },
  { href: "/training", label: "训练", icon: "◈" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [mode, setMode] = useState("idle");

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetchSystemMode();
        setMode(res.mode);
      } catch (e) {}
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-slate-900">
            ComfyDesk
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold">
            v1.0
          </span>
        </div>

        {/* Dynamic Mode Badge */}
        <div className="hidden md:flex items-center">
            <span className={`text-xs px-3 py-1 rounded-full border shadow-sm font-medium transition-all ${
              mode === 'idle' ? 'bg-zinc-50 border-zinc-200 text-zinc-600' :
              mode === 'training' ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse' :
              'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
            }`}>
              <span className="mr-2 inline-block w-2 h-2 rounded-full bg-current"></span>
              {mode === 'idle' ? 'System Idle' : mode === 'training' ? 'Training Active' : 'Generation Active'}
            </span>
        </div>

        {/* Nav links */}
        <div className="flex gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active 
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
