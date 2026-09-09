// ── Item & Transaction Types ───────────────────────────────

export interface TransactionItem {
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  cost: number;
  category: string;
}

export interface BulkInput {
  id: number;
  supplier_id: number | null;
  supplier_name?: string | null;
  timestamp: string;
  items: TransactionItem[];
  total: number;
}

export interface DayTransaction {
  date: string;
  day_total: number;
  bulk_inputs: BulkInput[];
}

// ── Dashboard ──────────────────────────────────────────────

export interface CategoryChartEntry {
  key: string;
  label: string;
  icon: string;
  total: number;
}

export interface DailyChartEntry {
  date: string;
  total: number;
}

export interface DashboardData {
  today: string;
  today_total: number;
  week_total: number;
  month_total: number;
  grand_total: number;
  total_days: number;
  total_bulks: number;
  total_items: number;
  avg_daily: number;
  daily_chart: DailyChartEntry[];
  category_chart: CategoryChartEntry[];
}

// ── Reports ────────────────────────────────────────────────

export interface RangeReportDay {
  date: string;
  day_total: number;
  bulk_count: number;
  item_count: number;
}

export interface RangeReport {
  start: string;
  end: string;
  days: RangeReportDay[];
  grand_total: number;
  total_items: number;
  days_with_data: number;
}

export interface CategoryReport {
  key: string;
  label: string;
  icon: string;
  total: number;
  count: number;
}

export interface MonthlyReport {
  month: string;
  total: number;
  days: number;
  items: number;
}

// ── Search ─────────────────────────────────────────────────

export interface SearchResult {
  date: string;
  bulk_id: number;
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  cost: number;
  category: string;
}

export interface SearchGroup {
  name: string;
  entries: SearchResult[];
  total_cost: number;
  total_qty: number;
  unit: string;
  min_price: number;
  max_price: number;
  count: number;
}

export interface SearchResponse {
  results: SearchResult[];
  groups: SearchGroup[];
}

// ── Suppliers ──────────────────────────────────────────────

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  address: string;
  notes: string;
}

// ── Form Input (for Add Transaction) ───────────────────────

export interface ItemFormRow {
  name: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
  category: string;
}

// ── Constants ──────────────────────────────────────────────

export const CATEGORIES = [
  { key: "bahan_pokok", label: "Bahan Pokok", icon: "🌾" },
  { key: "daging", label: "Daging & Seafood", icon: "🥩" },
  { key: "sayuran", label: "Sayuran & Buah", icon: "🥬" },
  { key: "bumbu", label: "Bumbu & Rempah", icon: "🧄" },
  { key: "susu_telur", label: "Susu & Telur", icon: "🥚" },
  { key: "minuman", label: "Minuman", icon: "🧃" },
  { key: "packaging", label: "Packaging", icon: "📦" },
  { key: "gas_listrik", label: "Gas & Utilitas", icon: "🔥" },
  { key: "lainnya", label: "Lainnya", icon: "📌" },
] as const;

export const UNITS = [
  "kg", "gram", "liter", "ml", "pcs", "butir",
  "ekor", "ikat", "bungkus", "botol", "kaleng",
  "dus", "lusin", "karung",
] as const;

export const PIE_COLORS = [
  "#e07a5f", "#3d405b", "#81b29a", "#f2cc8f", "#5e60ce",
  "#48bfe3", "#f77f00", "#d62828", "#264653",
];

// ── Formatters ─────────────────────────────────────────────

export function formatCurrency(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return formatCurrency(n);
}

export function getCategoryInfo(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? { key: "lainnya", label: "Lainnya", icon: "📌" };
}
