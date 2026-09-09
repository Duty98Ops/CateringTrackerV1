"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  fetchRangeReport, fetchCategoryReport, fetchMonthlyReport,
} from "@/lib/api";
import type { RangeReport, CategoryReport, MonthlyReport } from "@/lib/types";
import { formatCurrency, formatCurrencyShort, PIE_COLORS } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/stat-card";

type Tab = "range" | "monthly";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("range");

  const d30 = new Date();
  d30.setDate(d30.getDate() - 29);
  const [start, setStart] = useState(d30.toISOString().split("T")[0]);
  const [end, setEnd] = useState(new Date().toISOString().split("T")[0]);

  const [report, setReport] = useState<RangeReport | null>(null);
  const [catReport, setCatReport] = useState<CategoryReport[]>([]);
  const [monthly, setMonthly] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRange = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        fetchRangeReport(start, end),
        fetchCategoryReport(start, end),
      ]);
      setReport(r);
      setCatReport(c);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [start, end]);

  const loadMonthly = useCallback(async () => {
    setLoading(true);
    try { setMonthly(await fetchMonthlyReport()); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "range") loadRange();
    else loadMonthly();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">📊 Laporan</h1>
        <a
          href="/api/export/csv"
          download
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          📥 Ekspor CSV
        </a>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {([
          { key: "range" as Tab, label: "📆 Rentang Tanggal" },
          { key: "monthly" as Tab, label: "📅 Bulanan" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all sm:flex-none sm:px-5 sm:text-[13px] ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Range Tab ────────────────────────────────── */}
      {tab === "range" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input label="Dari" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input label="Sampai" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            <Button onClick={loadRange} disabled={loading}>
              {loading ? "Memuat..." : "Tampilkan"}
            </Button>
          </div>

          {report && (
            <>
              <div className="flex flex-wrap gap-4">
                <StatCard icon="💰" label="Total Pengeluaran" value={formatCurrency(report.grand_total)} accent="#e07a5f" />
                <StatCard icon="📅" label="Hari dengan Data" value={String(report.days_with_data)} />
                <StatCard icon="📦" label="Total Item" value={String(report.total_items)} />
              </div>

              {report.days.length > 0 && (
                <Card>
                  <h3 className="mb-4 text-sm font-bold text-muted-foreground">Pengeluaran per Hari</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={report.days}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrencyShort} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="day_total" fill="#81b29a" radius={[4, 4, 0, 0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {catReport.length > 0 && (
                <Card>
                  <h3 className="mb-4 text-sm font-bold text-muted-foreground">Breakdown Kategori</h3>
                  <div className="flex flex-col gap-2.5">
                    {catReport.map((c, i) => {
                      const pct = report.grand_total > 0 ? (c.total / report.grand_total) * 100 : 0;
                      return (
                        <div key={c.key} className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className="w-full text-[13px] font-medium sm:w-36">{c.icon} {c.label}</span>
                          <div className="h-5 flex-1 overflow-hidden rounded-md bg-secondary sm:h-6">
                            <div
                              className="h-full rounded-md transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-right text-xs font-bold sm:w-24">{formatCurrency(c.total)}</span>
                          <span className="whitespace-nowrap text-right text-[11px] text-muted-foreground sm:w-12">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Monthly Tab ──────────────────────────────── */}
      {tab === "monthly" && !loading && monthly.length > 0 && (
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="mb-4 text-sm font-bold text-muted-foreground">Tren Bulanan</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrencyShort} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line
                  type="monotone" dataKey="total" stroke="#e07a5f"
                  strokeWidth={3} dot={{ fill: "#e07a5f", r: 5 }} name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="overflow-hidden p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-secondary">
                  <th className="px-4 py-3 text-left font-semibold">Bulan</th>
                  <th className="px-4 py-3 text-right font-semibold">Hari</th>
                  <th className="px-4 py-3 text-right font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => (
                  <tr
                    key={m.month}
                    className={`border-t border-border ${i % 2 ? "bg-secondary/50" : ""}`}
                  >
                    <td className="px-4 py-2.5 font-semibold">{m.month}</td>
                    <td className="px-4 py-2.5 text-right">{m.days}</td>
                    <td className="px-4 py-2.5 text-right">{m.items}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">
                      {formatCurrency(m.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "monthly" && !loading && monthly.length === 0 && (
        <Card className="py-12 text-center text-muted-foreground">
          Belum ada data bulanan
        </Card>
      )}
    </div>
  );
}
