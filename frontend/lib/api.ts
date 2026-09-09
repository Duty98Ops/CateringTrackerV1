import type {
  DashboardData,
  DayTransaction,
  RangeReport,
  CategoryReport,
  MonthlyReport,
  SearchResponse,
  Supplier,
  TrashResponse,
  ForecastResponse,
} from "./types";
import { isNativeApp } from "./local-json";
import { localRequest } from "./local-api";

const BASE = "/api";

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (isNativeApp()) return localRequest<T>(path, opts);
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }

  return res.json();
}

// ── Dashboard ──────────────────────────────────────────────

export function fetchDashboard() {
  return request<DashboardData>("/dashboard");
}

// ── Transactions ───────────────────────────────────────────

export function fetchTransactions(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const qs = params.toString();
  return request<DayTransaction[]>(`/transactions${qs ? "?" + qs : ""}`);
}

export function addTransaction(body: {
  date: string;
  supplier_id: number | null;
  items: {
    name: string;
    quantity: number;
    unit: string;
    price_per_unit: number;
    category: string;
  }[];
}) {
  return request<{ success: boolean; date: string; bulk_id: number; total: number }>(
    "/transactions",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function deleteTransaction(date: string, bulkId: number) {
  return request<{ success: boolean }>(`/transactions/${date}/${bulkId}`, {
    method: "DELETE",
  });
}

export function editItem(
  date: string,
  bulkId: number,
  itemIdx: number,
  body: Partial<{
    name: string;
    quantity: number;
    unit: string;
    price_per_unit: number;
    category: string;
  }>
) {
  return request(`/transactions/${date}/${bulkId}/items/${itemIdx}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteItem(date: string, bulkId: number, itemIdx: number) {
  return request<{ success: boolean }>(
    `/transactions/${date}/${bulkId}/items/${itemIdx}`,
    { method: "DELETE" }
  );
}

// ── Reports ────────────────────────────────────────────────

export function fetchRangeReport(start: string, end: string) {
  return request<RangeReport>(`/reports/range?start=${start}&end=${end}`);
}

export function fetchCategoryReport(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const qs = params.toString();
  return request<CategoryReport[]>(`/reports/categories${qs ? "?" + qs : ""}`);
}

export function fetchMonthlyReport() {
  return request<MonthlyReport[]>("/reports/monthly");
}

// ── Search ─────────────────────────────────────────────────

export function searchItems(q: string) {
  return request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`);
}

// ── Suppliers ──────────────────────────────────────────────

export function fetchSuppliers() {
  return request<Supplier[]>("/suppliers");
}

export function addSupplier(body: {
  name: string;
  contact?: string;
  address?: string;
  notes?: string;
}) {
  return request<{ success: boolean; id: number }>("/suppliers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteSupplier(id: number) {
  return request<{ success: boolean }>(`/suppliers/${id}`, {
    method: "DELETE",
  });
}

// ── Trash / Soft Delete Recovery ───────────────────────────

export function fetchTrash() {
  return request<TrashResponse>("/trash");
}

export function restoreBulk(date: string, bulkId: number) {
  return request<{ success: boolean }>(`/trash/bulk/${date}/${bulkId}/restore`, {
    method: "POST",
  });
}

export function restoreItem(date: string, bulkId: number, itemIdx: number) {
  return request<{ success: boolean }>(
    `/trash/item/${date}/${bulkId}/${itemIdx}/restore`,
    { method: "POST" }
  );
}

export function purgeBulk(date: string, bulkId: number) {
  return request<{ success: boolean }>(`/trash/bulk/${date}/${bulkId}`, {
    method: "DELETE",
  });
}

export function purgeItem(date: string, bulkId: number, itemIdx: number) {
  return request<{ success: boolean }>(
    `/trash/item/${date}/${bulkId}/${itemIdx}`,
    { method: "DELETE" }
  );
}

export function emptyTrash() {
  return request<{ success: boolean; purged_bulks: number; purged_items: number }>(
    "/trash/empty",
    { method: "DELETE" }
  );
}

// ── Forecast ───────────────────────────────────────────────

export function fetchForecast(itemName: string, periods: number = 5) {
  return request<ForecastResponse>(
    `/forecast?item=${encodeURIComponent(itemName)}&periods=${periods}`
  );
}

// ── Export ─────────────────────────────────────────────────

export function getCsvExportUrl() {
  return "/api/export/csv";
}
