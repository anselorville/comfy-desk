"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "生成", icon: "✦" },
  { href: "/gallery", label: "画廊", icon: "▦" },
  { href: "/caption", label: "标注", icon: "◈" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: "rgba(17,17,24,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 1.5rem",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "1.4rem",
              background: "linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            ComfyDesk
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(124,58,237,0.2)",
              color: "#a855f7",
              border: "1px solid rgba(124,58,237,0.3)",
              fontWeight: 600,
            }}
          >
            v1.0
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 1rem",
                  borderRadius: 8,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  background: active
                    ? "rgba(124,58,237,0.2)"
                    : "transparent",
                  color: active ? "#a855f7" : "var(--text-muted)",
                  border: active
                    ? "1px solid rgba(124,58,237,0.35)"
                    : "1px solid transparent",
                }}
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
