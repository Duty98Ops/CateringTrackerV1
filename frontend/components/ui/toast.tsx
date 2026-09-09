"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 animate-slide-up rounded-xl px-6 py-3",
        "font-semibold text-sm text-white shadow-xl",
        type === "error" ? "bg-destructive" : "bg-emerald-500"
      )}
    >
      {type === "error" ? "✗" : "✓"} {message}
    </div>
  );
}
