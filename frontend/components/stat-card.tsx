import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <Card className="relative min-w-[180px] flex-1 p-5">
      <div
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl text-sm text-slate-700 dark:text-slate-200"
        style={{ backgroundColor: accent ? `${accent}15` : "hsl(var(--muted))" }}
        aria-hidden="true"
      >
        {icon}
      </div>

      <p className="mb-2 pr-11 text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{value}</p>
      <p className="mt-1 min-h-4 text-xs leading-4 text-muted-foreground">
        {sub ?? "Ringkasan periode saat ini"}
      </p>
    </Card>
  );
}
