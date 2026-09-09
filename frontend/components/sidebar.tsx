"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: "📊", label: "Dashboard" },
  { href: "/add", icon: "➕", label: "Tambah" },
  { href: "/transactions", icon: "📂", label: "Riwayat" },
  { href: "/reports", icon: "📈", label: "Laporan" },
  { href: "/search", icon: "🔍", label: "Cari" },
  { href: "/suppliers", icon: "🏪", label: "Supplier" },
  { href: "/trash", icon: "🗑️", label: "Sampah" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Mobile hamburger button — only visible on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg shadow-lg md:hidden"
        style={{ background: "hsl(var(--sidebar-bg))", color: "#fff" }}
        aria-label="Buka menu"
      >
        <span className="text-xl">☰</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      {/* Sidebar — fixed drawer on mobile, sticky column on desktop */}
      <aside
        className={cn(
          "fixed top-0 z-50 flex h-screen w-56 flex-col gap-1 overflow-y-auto p-3 transition-transform duration-200",
          "md:sticky md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: "hsl(var(--sidebar-bg))" }}
      >
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 text-xl text-white/70 hover:text-white md:hidden"
          aria-label="Tutup menu"
        >
          ✕
        </button>

        {/* Logo */}
        <div className="mb-5 px-3 pt-2 text-center">
          <div className="text-3xl">🍳</div>
          <div className="mt-1 text-sm font-extrabold tracking-tight text-white">
            Catering Tracker
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: "hsl(var(--sidebar-text))" }}>
            Monitoring Biaya Bahan
          </div>
        </div>

        {/* Nav Items */}
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-all",
                isActive ? "font-bold" : "hover:opacity-80"
              )}
              style={{
                background: isActive ? "rgba(192,94,60,0.15)" : "transparent",
                color: isActive
                  ? "hsl(var(--sidebar-active))"
                  : "hsl(var(--sidebar-text))",
              }}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {/* Footer */}
        <div
          className="mt-auto border-t border-white/5 p-3 text-center text-[10px]"
          style={{ color: "hsl(var(--sidebar-text))" }}
        >
          File-Based Data Management
          <br />
          MVP v1.0
        </div>
      </aside>
    </>
  );
}
