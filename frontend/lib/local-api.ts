import { CATEGORIES } from "./types";
import { readLocalData, writeLocalData } from "./local-json";

type Data = any;
const active = (value: any) => !value?.deleted_at;
const now = () => new Date();
const dateKey = (date = now()) => date.toISOString().slice(0, 10);
const timestamp = () => now().toISOString().slice(0, 19).replace("T", " ");
const dateKeys = (data: Data) => Object.keys(data).filter((key) => key !== "suppliers");
const dayTotal = (day: any) => (day?.bulk_inputs ?? []).filter(active)
  .reduce((sum: number, bulk: any) => sum + bulk.items.filter(active)
    .reduce((itemSum: number, item: any) => itemSum + Number(item.cost || 0), 0), 0);
const supplierName = (data: Data, id: number | null) => id == null ? null : data.suppliers?.[String(id)]?.name ?? null;
const recalc = (day: any) => { day.day_total = dayTotal(day); };
const fail = (message: string): never => { throw new Error(message); };
const bodyOf = (options: RequestInit) => options.body ? JSON.parse(String(options.body)) : {};

function dashboard(data: Data) {
  const today = dateKey();
  const totalFor = (key: string) => dayTotal(data[key]);
  const keys = dateKeys(data);
  const grand_total = keys.reduce((sum, key) => sum + totalFor(key), 0);
  const daily_chart = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (29 - index));
    const key = dateKey(date); return { date: key, total: totalFor(key) };
  });
  const week_total = daily_chart.slice(-7).reduce((sum, day) => sum + day.total, 0);
  const month_total = daily_chart.reduce((sum, day) => sum + day.total, 0);
  const totals: Record<string, number> = {};
  let total_bulks = 0; let total_items = 0; let total_days = 0;
  for (const key of keys) {
    const bulks = (data[key]?.bulk_inputs ?? []).filter(active);
    if (bulks.length) total_days += 1;
    total_bulks += bulks.length;
    for (const bulk of bulks) for (const item of bulk.items.filter(active)) {
      totals[item.category ?? "lainnya"] = (totals[item.category ?? "lainnya"] ?? 0) + Number(item.cost || 0);
      total_items += 1;
    }
  }
  const category_chart = CATEGORIES.map((category) => ({ ...category, total: totals[category.key] ?? 0 }))
    .filter((category) => category.total > 0).sort((a, b) => b.total - a.total);
  return { today, today_total: totalFor(today), week_total, month_total, grand_total, total_days, total_bulks, total_items,
    avg_daily: total_days ? grand_total / total_days : 0, daily_chart, category_chart };
}

function transactions(data: Data, start?: string, end?: string) {
  return dateKeys(data).sort().reverse().filter((key) => (!start || key >= start) && (!end || key <= end)).flatMap((date) => {
    const bulks = (data[date]?.bulk_inputs ?? []).filter(active).map((bulk: any) => {
      const items = bulk.items.filter(active); const total = items.reduce((sum: number, item: any) => sum + Number(item.cost || 0), 0);
      return items.length ? { ...bulk, items, total, supplier_name: supplierName(data, bulk.supplier_id) } : null;
    }).filter(Boolean);
    return bulks.length ? [{ date, day_total: bulks.reduce((sum: number, bulk: any) => sum + bulk.total, 0), bulk_inputs: bulks }] : [];
  });
}

function trash(data: Data) {
  const bulks: any[] = []; const items: any[] = [];
  for (const date of dateKeys(data).sort().reverse()) for (const bulk of data[date].bulk_inputs ?? []) {
    if (!active(bulk)) bulks.push({ date, bulk_id: bulk.id, deleted_at: bulk.deleted_at, timestamp: bulk.timestamp,
      supplier_name: supplierName(data, bulk.supplier_id), items: bulk.items, total: bulk.items.reduce((s: number, i: any) => s + Number(i.cost || 0), 0), item_count: bulk.items.length });
    else bulk.items.forEach((item: any, item_idx: number) => { if (!active(item)) items.push({ date, bulk_id: bulk.id, item_idx, deleted_at: item.deleted_at, ...item }); });
  }
  return { bulks, items };
}

export async function localRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const data = await readLocalData() as Data;
  const method = options.method ?? "GET";
  const body = bodyOf(options);
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);

  if (pathname === "/dashboard" && method === "GET") return dashboard(data) as T;
  if (pathname === "/transactions" && method === "GET") return transactions(data, params.get("start") ?? undefined, params.get("end") ?? undefined) as T;
  if (pathname === "/transactions" && method === "POST") {
    const date = body.date || dateKey(); const rawItems = body.items ?? [];
    const items = rawItems.map((item: any) => ({ name: String(item.name ?? "").trim(), quantity: Number(item.quantity), unit: item.unit ?? "pcs", price_per_unit: Number(item.price_per_unit), category: item.category ?? "lainnya" }))
      .filter((item: any) => item.name && item.quantity > 0 && item.price_per_unit > 0).map((item: any) => ({ ...item, cost: item.quantity * item.price_per_unit, deleted_at: null }));
    if (!items.length) fail("Tidak ada item valid");
    data[date] ??= { bulk_inputs: [], day_total: 0 }; const ids = data[date].bulk_inputs.map((bulk: any) => bulk.id);
    const bulk_id = ids.length ? Math.max(...ids) + 1 : 1; const total = items.reduce((sum: number, item: any) => sum + item.cost, 0);
    data[date].bulk_inputs.push({ id: bulk_id, supplier_id: body.supplier_id ?? null, timestamp: timestamp(), items, total, deleted_at: null }); recalc(data[date]); await writeLocalData(data);
    return { success: true, date, bulk_id, total } as T;
  }
  const tx = pathname.match(/^\/transactions\/([^/]+)\/(\d+)(?:\/items\/(\d+))?$/);
  if (tx) {
    const [, date, idText, itemText] = tx; const day = data[date]; const bulk = day?.bulk_inputs?.find((entry: any) => entry.id === Number(idText));
    if (!day || !bulk) fail("Data tidak ditemukan");
    if (itemText === undefined && method === "DELETE") { if (!active(bulk)) fail("Transaksi sudah dihapus"); bulk.deleted_at = timestamp(); recalc(day); await writeLocalData(data); return { success: true } as T; }
    const item = bulk.items[Number(itemText)]; if (!item) fail("Item tidak ditemukan");
    if (method === "PUT") { if (!active(item)) fail("Item sudah dihapus"); Object.assign(item, body); item.quantity = Number(item.quantity); item.price_per_unit = Number(item.price_per_unit); item.cost = item.quantity * item.price_per_unit; bulk.total = bulk.items.filter(active).reduce((s: number, v: any) => s + v.cost, 0); recalc(day); await writeLocalData(data); return { success: true, item } as T; }
    if (method === "DELETE") { if (!active(item)) fail("Item sudah dihapus"); item.deleted_at = timestamp(); bulk.total = bulk.items.filter(active).reduce((s: number, v: any) => s + v.cost, 0); recalc(day); await writeLocalData(data); return { success: true } as T; }
  }
  if (pathname === "/reports/range") { const start = params.get("start") ?? ""; const end = params.get("end") ?? ""; const days = transactions(data, start, end).map((day: any) => ({ date: day.date, day_total: day.day_total, bulk_count: day.bulk_inputs.length, item_count: day.bulk_inputs.reduce((sum: number, bulk: any) => sum + bulk.items.length, 0) })); return { start, end, days, grand_total: days.reduce((s: number, d: any) => s + d.day_total, 0), total_items: days.reduce((s: number, d: any) => s + d.item_count, 0), days_with_data: days.length } as T; }
  if (pathname === "/reports/categories") return dashboard(data).category_chart as T;
  if (pathname === "/reports/monthly") { const months: Record<string, any> = {}; for (const day of transactions(data) as any[]) { const month = day.date.slice(0, 7); months[month] ??= { month, total: 0, days: 0, items: 0 }; months[month].total += day.day_total; months[month].days += 1; months[month].items += day.bulk_inputs.reduce((s: number, b: any) => s + b.items.length, 0); } return Object.values(months).sort((a: any, b: any) => a.month.localeCompare(b.month)) as T; }
  if (pathname === "/search") { const q = (params.get("q") ?? "").trim().toLowerCase(); const results: any[] = []; if (q) for (const day of transactions(data) as any[]) for (const bulk of day.bulk_inputs) for (const item of bulk.items) if (item.name.toLowerCase().includes(q)) results.push({ date: day.date, bulk_id: bulk.id, ...item }); const grouped: Record<string, any> = {}; for (const entry of results) { const key = entry.name.toLowerCase(); grouped[key] ??= { name: entry.name, entries: [], total_cost: 0, total_qty: 0, unit: entry.unit, min_price: entry.price_per_unit, max_price: entry.price_per_unit, count: 0 }; const group = grouped[key]; group.entries.push(entry); group.total_cost += entry.cost; group.total_qty += entry.quantity; group.count += 1; group.min_price = Math.min(group.min_price, entry.price_per_unit); group.max_price = Math.max(group.max_price, entry.price_per_unit); } return { results, groups: Object.values(grouped).sort((a: any, b: any) => b.total_cost - a.total_cost) } as T; }
  if (pathname === "/forecast") { const item = (params.get("item") ?? "").trim().toLowerCase(); const periods = Number(params.get("periods") ?? 5); const history = (await localRequest<any>(`/search?q=${encodeURIComponent(item)}`)).results.filter((entry: any) => entry.name.toLowerCase() === item).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((entry: any) => ({ date: entry.date, price: entry.price_per_unit })); if (history.length < 2) return { history, forecast: [], summary: null, message: "Data harga belum cukup untuk prediksi" } as T; const n = history.length; const meanX = (n - 1) / 2; const meanY = history.reduce((sum: number, point: any) => sum + point.price, 0) / n; const slope = history.reduce((sum: number, point: any, index: number) => sum + (index - meanX) * (point.price - meanY), 0) / history.reduce((sum: number, _: any, index: number) => sum + (index - meanX) ** 2, 0); const last = new Date(`${history[n - 1].date}T00:00:00`); const forecast = Array.from({ length: periods }, (_, index) => { const next = new Date(last); next.setDate(last.getDate() + index + 1); return { date: dateKey(next), price: Math.max(0, Math.round(history[n - 1].price + slope * (index + 1))) }; }); return { history, forecast, summary: { trend: slope > 0 ? "naik" : slope < 0 ? "turun" : "stabil", slope_per_day: slope, change_per_interval: slope, change_pct_per_interval: meanY ? slope / meanY * 100 : 0, r_squared: 0, avg_interval_days: 1, moving_avg_last_3: history.slice(-3).reduce((sum: number, point: any) => sum + point.price, 0) / Math.min(3, n), data_points: n } } as T; }
  if (pathname === "/suppliers" && method === "GET") return Object.values(data.suppliers ?? {}).sort((a: any, b: any) => a.id - b.id) as T;
  if (pathname === "/suppliers" && method === "POST") { const name = String(body.name ?? "").trim(); if (!name) fail("Nama supplier wajib diisi"); const id = Math.max(0, ...Object.keys(data.suppliers ?? {}).map(Number)) + 1; data.suppliers[String(id)] = { id, name, contact: body.contact ?? "", address: body.address ?? "", notes: body.notes ?? "" }; await writeLocalData(data); return { success: true, id } as T; }
  const supplier = pathname.match(/^\/suppliers\/(\d+)$/); if (supplier) { const id = supplier[1]; if (!data.suppliers?.[id]) fail("Supplier tidak ditemukan"); if (method === "DELETE") { delete data.suppliers[id]; await writeLocalData(data); return { success: true } as T; } if (method === "PUT") { Object.assign(data.suppliers[id], body); await writeLocalData(data); return { success: true } as T; } }
  if (pathname === "/trash" && method === "GET") return trash(data) as T;
  if (pathname === "/trash/empty" && method === "DELETE") { let purged_bulks = 0; let purged_items = 0; for (const date of dateKeys(data)) { data[date].bulk_inputs = data[date].bulk_inputs.filter((bulk: any) => { if (!active(bulk)) { purged_bulks++; return false; } const old = bulk.items.length; bulk.items = bulk.items.filter(active); purged_items += old - bulk.items.length; return bulk.items.length; }); if (!data[date].bulk_inputs.length) delete data[date]; else recalc(data[date]); } await writeLocalData(data); return { success: true, purged_bulks, purged_items } as T; }
  const trashMatch = pathname.match(/^\/trash\/(bulk|item)\/([^/]+)\/(\d+)(?:\/(\d+))?(\/restore)?$/); if (trashMatch) { const [, kind, date, idText, itemText, restore] = trashMatch; const day = data[date]; const bulk = day?.bulk_inputs?.find((entry: any) => entry.id === Number(idText)); if (!bulk) fail("Data tidak ditemukan"); if (kind === "bulk") { if (restore) bulk.deleted_at = null; else { if (active(bulk)) fail("Transaksi belum ada di sampah"); day.bulk_inputs = day.bulk_inputs.filter((entry: any) => entry !== bulk); } } else { const item = bulk.items[Number(itemText)]; if (!item) fail("Item tidak ditemukan"); if (restore) item.deleted_at = null; else { if (active(item)) fail("Item belum ada di sampah"); bulk.items.splice(Number(itemText), 1); } } if (!day.bulk_inputs.length) delete data[date]; else recalc(day); await writeLocalData(data); return { success: true } as T; }
  return fail(`Endpoint lokal belum tersedia: ${method} ${pathname}`);
}
