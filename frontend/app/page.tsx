"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { BarChart3, CalendarClock, CalendarDays, CalendarRange, Plus, WalletCards } from "lucide-react";

import { fetchDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { formatCurrency, PIE_COLORS } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";

function formatAxisCurrency(value: number) {
  if (value === 0) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return value.toLocaleString("id-ID");
}

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

  const categoryTotal = dash.category_chart.reduce((total, category) => total + category.total, 0);
  const hasChartData = dash.daily_chart.some((day) => day.total > 0);

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
          icon={<CalendarDays className="h-4 w-4" />}
          label="Hari Ini"
          value={formatCurrency(dash.today_total)}
          sub={dash.today_total > 0 ? "Transaksi tercatat hari ini" : "Belum ada transaksi hari ini"}
          accent="#e07a5f"
        />
        <StatCard
          icon={<CalendarRange className="h-4 w-4" />}
          label="7 Hari Terakhir"
          value={formatCurrency(dash.week_total)}
          sub={dash.week_total > 0 ? "Berdasarkan 7 hari terakhir" : "Belum ada transaksi 7 hari terakhir"}
          accent="#3d405b"
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="30 Hari Terakhir"
          value={formatCurrency(dash.month_total)}
          sub={dash.month_total > 0 ? "Berdasarkan 30 hari terakhir" : "Belum ada transaksi 30 hari terakhir"}
          accent="#81b29a"
        />
        <StatCard
          icon={<WalletCards className="h-4 w-4" />}
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
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dash.daily_chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickCount={5}
                  tickFormatter={formatAxisCurrency}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(l: string) => `Tanggal: ${l}`}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-5 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Belum ada grafik pengeluaran bulan ini</p>
              <p className="mt-1 text-xs text-muted-foreground">Catat belanja pertama untuk mulai melihat tren biaya.</p>
              <Button className="mt-4" size="sm" onClick={() => router.push("/add")}>
                <Plus className="h-3.5 w-3.5" /> Catat Belanja Sekarang
              </Button>
            </div>
          )}
        </Card>

        {/* Pie Chart — 1/3 width */}
        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-muted-foreground">
              🏷️ Komposisi Kategori
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">30 hari terakhir</span>
          </div>
          {dash.category_chart.length > 0 ? (
            <>
              <div className="relative h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dash.category_chart}
                      dataKey="total"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {dash.category_chart.map((category, i) => (
                        <Cell key={category.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                    {dash.category_chart.length}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">Kategori Aktif</span>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {dash.category_chart.map((c, i) => (
                  <div key={c.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                        {c.label}{" "}
                        <span className="text-muted-foreground">
                          {categoryTotal > 0 ? Math.round((c.total / categoryTotal) * 100) : 0}%
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                        {formatCurrency(c.total)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0}%`,
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
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
