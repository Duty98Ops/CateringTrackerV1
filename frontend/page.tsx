"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

import { fetchDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { formatCurrency, formatCurrencyShort, PIE_COLORS } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";

export default function DashboardPage() {
  const router = useRouter();
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setDash)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Memuat dashboard...
      </div>
    );
  }

  if (error || !dash) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-5xl">⚠️</span>
        <p className="font-semibold">Gagal memuat dashboard</p>
        <p className="text-sm">Pastikan Flask server berjalan di port 5000</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan biaya operasional bahan baku
          </p>
        </div>
        <Button onClick={() => router.push("/add")}>＋ Tambah Belanja</Button>
      </div>

      {/* Stat Cards */}
      <div className="flex flex-wrap gap-4">
        <StatCard
          icon="📅"
          label="Hari Ini"
          value={formatCurrency(dash.today_total)}
          accent="#e07a5f"
        />
        <StatCard
          icon="📆"
          label="7 Hari Terakhir"
          value={formatCurrency(dash.week_total)}
          accent="#3d405b"
        />
        <StatCard
          icon="🗓️"
          label="30 Hari Terakhir"
          value={formatCurrency(dash.month_total)}
          accent="#81b29a"
        />
        <StatCard
          icon="💰"
          label="Total Keseluruhan"
          value={formatCurrency(dash.grand_total)}
          sub={`${dash.total_days} hari · rata-rata ${formatCurrency(dash.avg_daily)}/hari`}
          accent="#5e60ce"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Bar Chart — 2/3 width */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-muted-foreground">
            📈 Tren Pengeluaran 30 Hari
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dash.daily_chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrencyShort} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l: string) => `Tanggal: ${l}`}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart — 1/3 width */}
        <Card>
          <h3 className="mb-4 text-sm font-bold text-muted-foreground">
            🏷️ Komposisi Kategori
          </h3>
          {dash.category_chart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={dash.category_chart}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {dash.category_chart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                {dash.category_chart.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-1 text-[11px]">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">
                      {c.icon} {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <span className="text-4xl">📂</span>
              <p className="mt-2 text-sm font-medium">Belum ada data</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
