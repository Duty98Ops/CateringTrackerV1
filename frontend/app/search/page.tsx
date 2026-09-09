"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { searchItems, fetchForecast } from "@/lib/api";
import type {
  SearchResponse, SearchResult, SearchGroup, ForecastResponse,
} from "@/lib/types";
import { formatCurrency, formatCurrencyShort } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/stat-card";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setActiveGroup(null);
    setForecast(null);
    try {
      setData(await searchItems(query));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const groups = data?.groups ?? [];
  const allResults = data?.results ?? [];
  const totalSpent = allResults.reduce((s, r) => s + r.cost, 0);

  const activeGroupData: SearchGroup | undefined = activeGroup
    ? groups.find((g) => g.name.toLowerCase() === activeGroup)
    : undefined;
  const shownEntries: SearchResult[] = activeGroupData
    ? activeGroupData.entries
    : allResults;
  const shownPrices = shownEntries.map((r) => r.price_per_unit);

  // Auto-fetch forecast when a specific group is selected (or single-group result)
  useEffect(() => {
    const itemName = activeGroupData?.name ?? (groups.length === 1 ? groups[0].name : null);
    if (!itemName) {
      setForecast(null);
      return;
    }
    fetchForecast(itemName, 5)
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [activeGroupData, groups]);

  // Build combined chart data (history + forecast as separate series)
  type ChartPoint = { date: string; actual: number | null; predicted: number | null };
  const chartData: ChartPoint[] = (() => {
    if (!forecast || !forecast.summary) {
      return shownEntries.map((r) => ({
        date: r.date,
        actual: r.price_per_unit,
        predicted: null,
      }));
    }
    const points: ChartPoint[] = forecast.history.map((h) => ({
      date: h.date,
      actual: h.price,
      predicted: null,
    }));
    // Anchor forecast line at last actual point
    if (forecast.history.length > 0) {
      const last = forecast.history[forecast.history.length - 1];
      points.push({ date: last.date, actual: last.price, predicted: last.price });
    }
    forecast.forecast.forEach((f) => {
      points.push({ date: f.date, actual: null, predicted: f.price });
    });
    return points;
  })();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">🔍 Cari Bahan</h1>

      {/* Search bar */}
      <div className="flex gap-3">
        <Input
          placeholder="Ketik nama bahan..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="flex-1"
        />
        <Button onClick={search} disabled={loading || !query.trim()}>
          {loading ? "..." : "Cari"}
        </Button>
      </div>

      {data && allResults.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">🔍</span>
          <p className="text-lg font-bold">Tidak ditemukan: &quot;{query}&quot;</p>
          <p className="text-sm text-muted-foreground">Coba kata kunci lain</p>
        </Card>
      )}

      {data && allResults.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4">
            <StatCard icon="📦" label="Total Pembelian" value={allResults.length + " kali"} />
            <StatCard icon="💰" label="Total Pengeluaran" value={formatCurrency(totalSpent)} accent="#e07a5f" />
            <StatCard icon="🏷️" label="Item Berbeda" value={groups.length + " jenis"} accent="#5e60ce" />
          </div>

          {groups.length > 1 && (
            <Card>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">
                Hasil pencarian &quot;{query}&quot; menemukan {groups.length} item berbeda:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveGroup(null)}
                  className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                    !activeGroup
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  Semua ({allResults.length})
                </button>
                {groups.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => setActiveGroup(g.name.toLowerCase())}
                    className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                      activeGroup === g.name.toLowerCase()
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {g.name} ({g.count})
                  </button>
                ))}
              </div>
            </Card>
          )}

          {activeGroupData && (
            <div className="flex flex-wrap gap-4">
              <StatCard icon="📦" label={"Pembelian " + activeGroupData.name} value={activeGroupData.count + " kali"} />
              <StatCard icon="💰" label="Total" value={formatCurrency(activeGroupData.total_cost)} accent="#e07a5f" />
              <StatCard icon="📉" label="Harga Terendah" value={formatCurrency(activeGroupData.min_price)} accent="#22c55e" />
              <StatCard icon="📈" label="Harga Tertinggi" value={formatCurrency(activeGroupData.max_price)} accent="#ef4444" />
            </div>
          )}

          {/* Forecast Summary */}
          {forecast?.summary && (
            <Card className="border-l-4 border-l-primary">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">
                    🔮 Prediksi Harga{" "}
                    {activeGroupData?.name ?? (groups.length === 1 ? groups[0].name : "")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Berdasarkan {forecast.summary.data_points} data historis · regresi linear · R² = {forecast.summary.r_squared.toFixed(2)}
                  </p>
                </div>
                <div
                  className="rounded-lg px-3 py-1 text-xs font-bold"
                  style={{
                    background:
                      forecast.summary.trend === "naik"
                        ? "#ef444422"
                        : forecast.summary.trend === "turun"
                        ? "#22c55e22"
                        : "hsl(var(--muted))",
                    color:
                      forecast.summary.trend === "naik"
                        ? "#ef4444"
                        : forecast.summary.trend === "turun"
                        ? "#22c55e"
                        : "hsl(var(--muted-foreground))",
                  }}
                >
                  Tren: {forecast.summary.trend.toUpperCase()}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Pembelian Berikutnya</p>
                  <p className="text-base font-bold text-primary">
                    {forecast.forecast.length > 0 ? formatCurrency(forecast.forecast[0].price) : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ≈ {forecast.summary.avg_interval_days} hari ke depan
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Perubahan per Beli</p>
                  <p
                    className="text-base font-bold"
                    style={{
                      color:
                        forecast.summary.change_per_interval > 0
                          ? "#ef4444"
                          : forecast.summary.change_per_interval < 0
                          ? "#22c55e"
                          : undefined,
                    }}
                  >
                    {forecast.summary.change_per_interval > 0 ? "+" : ""}
                    {formatCurrency(forecast.summary.change_per_interval)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {forecast.summary.change_pct_per_interval > 0 ? "+" : ""}
                    {forecast.summary.change_pct_per_interval.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Rata-rata 3 Terakhir</p>
                  <p className="text-base font-bold">{formatCurrency(forecast.summary.moving_avg_last_3)}</p>
                  <p className="text-[10px] text-muted-foreground">Moving average</p>
                </div>
              </div>

              {forecast.summary.r_squared < 0.5 && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  ⚠️ Tingkat kepercayaan rendah (R² &lt; 0.5). Harga mungkin tidak mengikuti pola linear yang jelas.
                </p>
              )}
            </Card>
          )}

          {forecast && forecast.summary === null && forecast.message && (
            <Card>
              <p className="text-sm text-muted-foreground">🔮 {forecast.message}</p>
            </Card>
          )}

          {/* Results table */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-secondary">
                    <th className="whitespace-nowrap px-4 py-2.5 text-left font-semibold">Tanggal</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left font-semibold">Bahan</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">Jumlah</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">Harga/Unit</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {shownEntries.map((r, i) => (
                    <tr
                      key={`${r.date}-${r.bulk_id}-${i}`}
                      className={`border-t border-border ${i % 2 ? "bg-secondary/50" : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5">{r.date}</td>
                      <td className="px-4 py-2.5">{r.name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {r.quantity} {r.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">{formatCurrency(r.price_per_unit)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">{formatCurrency(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Price + Forecast chart */}
          {shownPrices.length >= 2 && (
            <Card>
              <h3 className="mb-3 text-sm font-bold text-muted-foreground">
                📈 Tren & Prediksi Harga per Unit
                {activeGroupData ? `: ${activeGroupData.name}` : ""}
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrencyShort} />
                  <Tooltip
                    formatter={(v) => (v === null || v === undefined ? "—" : formatCurrency(Number(v)))}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#5e60ce"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Aktual"
                    connectNulls={false}
                  />
                  {forecast?.summary && (
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#e07a5f"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3 }}
                      name="Prediksi"
                      connectNulls={true}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              {forecast?.summary && (
                <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4" style={{ background: "#5e60ce" }} />
                    Harga Aktual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: "#e07a5f" }} />
                    Prediksi
                  </span>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
