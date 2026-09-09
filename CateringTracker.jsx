import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

// ── Config ─────────────────────────────────────────────────────
// const API = "http://localhost:5000/api";
// Ganti baris ini:
// const API = "http://localhost:5000/api";

// Menjadi baris ini:
const API = "/api";
const CATEGORIES = [
  { key: "bahan_pokok", label: "Bahan Pokok", icon: "🌾" },
  { key: "daging", label: "Daging & Seafood", icon: "🥩" },
  { key: "sayuran", label: "Sayuran & Buah", icon: "🥬" },
  { key: "bumbu", label: "Bumbu & Rempah", icon: "🧄" },
  { key: "susu_telur", label: "Susu & Telur", icon: "🥚" },
  { key: "minuman", label: "Minuman", icon: "🧃" },
  { key: "packaging", label: "Packaging", icon: "📦" },
  { key: "gas_listrik", label: "Gas & Utilitas", icon: "🔥" },
  { key: "lainnya", label: "Lainnya", icon: "📌" },
];

const UNITS = ["kg","gram","liter","ml","pcs","butir","ekor","ikat","bungkus","botol","kaleng","dus","lusin","karung"];

const PIE_COLORS = ["#e07a5f","#3d405b","#81b29a","#f2cc8f","#5e60ce","#48bfe3","#f77f00","#d62828","#264653"];

const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtShort = (n) => {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return fmt(n);
};

// ── Fetch helper ───────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  if (res.headers.get("content-type")?.includes("json")) return res.json();
  return res;
}

// ── Reusable Components ────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: "20px 24px", flex: "1 1 200px", minWidth: 180,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -8, right: -8, fontSize: 56, opacity: 0.07,
        transform: "rotate(12deg)", pointerEvents: "none",
      }}>{icon}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || "var(--text)", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style, small }) {
  const base = {
    padding: small ? "6px 14px" : "10px 20px",
    fontSize: small ? 12 : 14,
    fontWeight: 600, borderRadius: 10, cursor: disabled ? "default" : "pointer",
    border: "none", transition: "all .15s", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: 6,
  };
  const variants = {
    primary: { background: "var(--accent)", color: "#fff" },
    secondary: { background: "var(--bg-raised)", color: "var(--text)", border: "1px solid var(--border)" },
    danger: { background: "#ef4444", color: "#fff" },
    ghost: { background: "transparent", color: "var(--accent)" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }}
      onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</label>}
      <input {...props} style={{
        padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--bg-raised)", color: "var(--text)", fontSize: 14,
        outline: "none", transition: "border .15s", ...props.style,
      }} />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</label>}
      <select {...props} style={{
        padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--bg-raised)", color: "var(--text)", fontSize: 14, outline: "none",
        ...props.style,
      }}>
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card)", borderRadius: 20, padding: 28,
        maxWidth: wide ? 700 : 500, width: "100%", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer",
            color: "var(--muted)", padding: "4px 8px",
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 2000,
      background: type === "error" ? "#ef4444" : "#22c55e", color: "#fff",
      padding: "12px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.2)", animation: "slideUp .3s ease",
    }}>
      {type === "error" ? "✗" : "✓"} {message}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function Tabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--bg-raised)", borderRadius: 12, padding: 4 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)} style={{
          padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600, transition: "all .15s",
          background: active === t.key ? "var(--accent)" : "transparent",
          color: active === t.key ? "#fff" : "var(--muted)",
        }}>
          {t.icon && <span style={{ marginRight: 5 }}>{t.icon}</span>}{t.label}
        </button>
      ))}
    </div>
  );
}

// ── Pages ──────────────────────────────────────────────────────

function DashboardPage({ onNav }) {
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/dashboard").then(setDash).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Memuat dashboard...</div>;
  if (!dash) return <EmptyState icon="📊" title="Gagal memuat" sub="Periksa koneksi ke server Flask" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Dashboard</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Ringkasan biaya operasional bahan baku</p>
        </div>
        <Btn onClick={() => onNav("add")}>＋ Tambah Belanja</Btn>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <StatCard icon="📅" label="Hari Ini" value={fmt(dash.today_total)} accent="#e07a5f" />
        <StatCard icon="📆" label="7 Hari Terakhir" value={fmt(dash.week_total)} accent="#3d405b" />
        <StatCard icon="🗓️" label="30 Hari Terakhir" value={fmt(dash.month_total)} accent="#81b29a" />
        <StatCard icon="💰" label="Total Keseluruhan" value={fmt(dash.grand_total)} sub={`${dash.total_days} hari • rata-rata ${fmt(dash.avg_daily)}/hari`} accent="#5e60ce" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, minHeight: 300 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "var(--muted)" }}>📈 Tren Pengeluaran 30 Hari</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dash.daily_chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
              <Tooltip formatter={v => fmt(v)} labelFormatter={l => `Tanggal: ${l}`} />
              <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "var(--muted)" }}>🏷️ Komposisi Kategori</h3>
          {dash.category_chart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={dash.category_chart} dataKey="total" nameKey="label" cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {dash.category_chart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "center" }}>
                {dash.category_chart.map((c, i) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block" }} />
                    <span style={{ color: "var(--muted)" }}>{c.icon} {c.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon="📂" title="Belum ada data" sub="Tambah belanja untuk melihat grafik" />
          )}
        </div>
      </div>
    </div>
  );
}

function AddTransactionPage({ onNav, suppliers, toast }) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState([{ name: "", quantity: "", unit: "kg", price_per_unit: "", category: "bahan_pokok" }]);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems(p => [...p, { name: "", quantity: "", unit: "kg", price_per_unit: "", category: "bahan_pokok" }]);
  const removeRow = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setItems(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const total = items.reduce((s, r) => {
    const q = parseFloat(r.quantity) || 0;
    const p = parseFloat(r.price_per_unit) || 0;
    return s + q * p;
  }, 0);

  const validItems = items.filter(r => r.name && parseFloat(r.quantity) > 0 && parseFloat(r.price_per_unit) > 0);

  const save = async () => {
    if (validItems.length === 0) return;
    setSaving(true);
    try {
      await api("/transactions", {
        method: "POST",
        body: JSON.stringify({
          date,
          supplier_id: supplierId ? parseInt(supplierId) : null,
          items: validItems.map(r => ({
            ...r,
            quantity: parseFloat(r.quantity),
            price_per_unit: parseFloat(r.price_per_unit),
          })),
        }),
      });
      toast("Belanja berhasil disimpan!");
      onNav("transactions");
    } catch (e) {
      toast("Gagal menyimpan: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>➕ Tambah Belanja Baru</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Input bahan-bahan yang dibeli</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Input label="Tanggal" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Select label="Supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)}
          options={[{ value: "", label: "— Pilih Supplier —" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 100px 1.2fr 140px 36px", gap: "8px 10px", alignItems: "end", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8, paddingLeft: 2 }}>
          <span>Nama Bahan</span><span>Jumlah</span><span>Satuan</span><span>Harga/Unit</span><span>Kategori</span><span></span>
        </div>

        {items.map((row, i) => {
          const cost = (parseFloat(row.quantity) || 0) * (parseFloat(row.price_per_unit) || 0);
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 100px 1.2fr 140px 36px",
              gap: "8px 10px", alignItems: "center", marginBottom: 8,
              padding: "10px 8px", borderRadius: 10,
              background: i % 2 === 0 ? "var(--bg-raised)" : "transparent",
            }}>
              <input placeholder="cth: Ayam" value={row.name} onChange={e => updateRow(i, "name", e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }} />
              <input type="number" placeholder="0" value={row.quantity} onChange={e => updateRow(i, "quantity", e.target.value)} min="0" step="any"
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }} />
              <select value={row.unit} onChange={e => updateRow(i, "unit", e.target.value)}
                style={{ padding: "8px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--muted)" }}>Rp</span>
                <input type="number" placeholder="0" value={row.price_per_unit} onChange={e => updateRow(i, "price_per_unit", e.target.value)} min="0"
                  style={{ padding: "8px 12px 8px 30px", width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }} />
              </div>
              <select value={row.category} onChange={e => updateRow(i, "category", e.target.value)}
                style={{ padding: "8px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 11 }}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
              </select>
              <button onClick={() => removeRow(i)} disabled={items.length <= 1}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: items.length <= 1 ? "var(--border)" : "#ef4444", padding: 4 }}>
                ✕
              </button>
              {cost > 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "right", fontSize: 11, color: "var(--muted)", paddingRight: 44, marginTop: -4 }}>
                  = {fmt(cost)}
                </div>
              )}
            </div>
          );
        })}

        <Btn variant="ghost" onClick={addRow} small style={{ marginTop: 8 }}>＋ Tambah Baris</Btn>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 24px",
      }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Total Belanja</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>{fmt(total)}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{validItems.length} item valid</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn variant="secondary" onClick={() => onNav("dashboard")}>Batal</Btn>
          <Btn onClick={save} disabled={saving || validItems.length === 0}>
            {saving ? "Menyimpan..." : "💾 Simpan"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function TransactionsPage({ toast }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api("/transactions").then(setTxns).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteBulk = async (date, bulkId) => {
    if (!confirm("Hapus belanja ini?")) return;
    try {
      await api(`/transactions/${date}/${bulkId}`, { method: "DELETE" });
      toast("Belanja dihapus");
      load();
    } catch (e) { toast("Gagal: " + e.message, "error"); }
  };

  const deleteItem = async (date, bulkId, idx) => {
    if (!confirm("Hapus item ini?")) return;
    try {
      await api(`/transactions/${date}/${bulkId}/items/${idx}`, { method: "DELETE" });
      toast("Item dihapus");
      load();
    } catch (e) { toast("Gagal: " + e.message, "error"); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Memuat...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📂 Riwayat Transaksi</h1>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{txns.length} hari tercatat</div>
      </div>

      {txns.length === 0 ? (
        <EmptyState icon="📋" title="Belum ada transaksi" sub="Tambah belanja untuk memulai" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {txns.map(day => (
            <div key={day.date} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
              overflow: "hidden",
            }}>
              <div onClick={() => setExpanded(expanded === day.date ? null : day.date)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 20px", cursor: "pointer", transition: "background .1s",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{day.date}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {day.bulk_inputs.length} belanja • {day.bulk_inputs.reduce((s, b) => s + b.items.length, 0)} item
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>{fmt(day.day_total)}</span>
                  <span style={{ fontSize: 12, transition: "transform .2s", transform: expanded === day.date ? "rotate(180deg)" : "none" }}>▼</span>
                </div>
              </div>

              {expanded === day.date && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "12px 20px" }}>
                  {day.bulk_inputs.map(bulk => (
                    <div key={bulk.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          🛒 Belanja #{bulk.id}
                          {bulk.supplier_name && <span style={{ color: "var(--muted)", fontWeight: 400 }}> • 🏪 {bulk.supplier_name}</span>}
                        </div>
                        <Btn variant="danger" small onClick={() => deleteBulk(day.date, bulk.id)}>Hapus</Btn>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)" }}>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>Bahan</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>Jumlah</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>Harga/Unit</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>Total</th>
                            <th style={{ width: 32 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulk.items.map((item, idx) => {
                            const cat = CATEGORIES.find(c => c.key === item.category);
                            return (
                              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "8px 8px" }}>
                                  <span style={{ marginRight: 4 }}>{cat?.icon || "📌"}</span>
                                  {item.name}
                                </td>
                                <td style={{ textAlign: "right", padding: "8px", color: "var(--muted)" }}>
                                  {item.quantity} {item.unit}
                                </td>
                                <td style={{ textAlign: "right", padding: "8px", color: "var(--muted)" }}>{fmt(item.price_per_unit)}</td>
                                <td style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>{fmt(item.cost)}</td>
                                <td>
                                  <button onClick={() => deleteItem(day.date, bulk.id, idx)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12 }}>✕</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ textAlign: "right", fontWeight: 700, padding: "8px", fontSize: 14 }}>
                        Subtotal: {fmt(bulk.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsPage() {
  const [tab, setTab] = useState("range");
  const [start, setStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().split("T")[0];
  });
  const [end, setEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState(null);
  const [catReport, setCatReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadRange = useCallback(async () => {
    setLoading(true);
    try {
      const [range, cats] = await Promise.all([
        api(`/reports/range?start=${start}&end=${end}`),
        api(`/reports/categories?start=${start}&end=${end}`),
      ]);
      setReport(range);
      setCatReport(cats);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [start, end]);

  const loadMonthly = useCallback(async () => {
    setLoading(true);
    try { setMonthlyReport(await api("/reports/monthly")); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "range") loadRange();
    else loadMonthly();
  }, [tab, loadRange, loadMonthly]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>📊 Laporan</h1>

      <Tabs tabs={[
        { key: "range", label: "Rentang Tanggal", icon: "📆" },
        { key: "monthly", label: "Bulanan", icon: "📅" },
      ]} active={tab} onSelect={setTab} />

      {tab === "range" && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "end", marginBottom: 20, flexWrap: "wrap" }}>
            <Input label="Dari" type="date" value={start} onChange={e => setStart(e.target.value)} />
            <Input label="Sampai" type="date" value={end} onChange={e => setEnd(e.target.value)} />
            <Btn onClick={loadRange} disabled={loading}>Tampilkan</Btn>
          </div>

          {loading ? <p style={{ color: "var(--muted)" }}>Memuat...</p> : report && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <StatCard icon="💰" label="Total Pengeluaran" value={fmt(report.grand_total)} accent="#e07a5f" />
                <StatCard icon="📅" label="Hari dengan Data" value={report.days_with_data} />
                <StatCard icon="📦" label="Total Item" value={report.total_items} />
              </div>

              {report.days.length > 0 && (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "var(--muted)" }}>Pengeluaran per Hari</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={report.days}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="day_total" fill="#81b29a" radius={[4, 4, 0, 0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {catReport && catReport.length > 0 && (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "var(--muted)" }}>Breakdown Kategori</h3>
                  {catReport.map((c, i) => {
                    const pct = report.grand_total > 0 ? (c.total / report.grand_total * 100) : 0;
                    return (
                      <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <span style={{ width: 140, fontSize: 13, fontWeight: 500 }}>{c.icon} {c.label}</span>
                        <div style={{ flex: 1, height: 24, background: "var(--bg-raised)", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 6, transition: "width .5s" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, width: 100, textAlign: "right" }}>{fmt(c.total)}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", width: 45, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "monthly" && (
        <div style={{ marginTop: 20 }}>
          {loading ? <p style={{ color: "var(--muted)" }}>Memuat...</p> : monthlyReport && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "var(--muted)" }}>Tren Bulanan</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyReport}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Line type="monotone" dataKey="total" stroke="#e07a5f" strokeWidth={3} dot={{ fill: "#e07a5f", r: 5 }} name="Total" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-raised)" }}>
                      <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Bulan</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}>Hari</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}>Item</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.map((m, i) => (
                      <tr key={m.month} style={{ borderTop: "1px solid var(--border)", background: i % 2 ? "var(--bg-raised)" : "transparent" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{m.month}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>{m.days}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>{m.items}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>{fmt(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try { setResults(await api(`/search?q=${encodeURIComponent(query)}`)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const totalSpent = results ? results.reduce((s, r) => s + r.cost, 0) : 0;
  const prices = results?.map(r => r.price_per_unit) || [];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>🔍 Cari Bahan</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <Input placeholder="Ketik nama bahan..." value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()} style={{ flex: 1 }} />
        <Btn onClick={search} disabled={loading || !query.trim()}>{loading ? "..." : "Cari"}</Btn>
      </div>

      {results && results.length === 0 && (
        <EmptyState icon="🔍" title={`Tidak ditemukan: "${query}"`} sub="Coba kata kunci lain" />
      )}

      {results && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard icon="📦" label="Total Pembelian" value={results.length + " kali"} />
            <StatCard icon="💰" label="Total Pengeluaran" value={fmt(totalSpent)} accent="#e07a5f" />
            {prices.length >= 2 && (
              <>
                <StatCard icon="📉" label="Harga Terendah" value={fmt(Math.min(...prices))} accent="#22c55e" />
                <StatCard icon="📈" label="Harga Tertinggi" value={fmt(Math.max(...prices))} accent="#ef4444" />
              </>
            )}
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-raised)" }}>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Tanggal</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Bahan</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600 }}>Jumlah</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600 }}>Harga/Unit</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)", background: i % 2 ? "var(--bg-raised)" : "transparent" }}>
                    <td style={{ padding: "10px 16px" }}>{r.date}</td>
                    <td style={{ padding: "10px 16px" }}>{r.name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{r.quantity} {r.unit}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{fmt(r.price_per_unit)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>{fmt(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {prices.length >= 3 && (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "var(--muted)" }}>📈 Tren Harga per Unit</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={results}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Line type="monotone" dataKey="price_per_unit" stroke="#5e60ce" strokeWidth={2} dot={{ r: 4 }} name="Harga/Unit" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuppliersPage({ suppliers, reload, toast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api("/suppliers", { method: "POST", body: JSON.stringify(form) });
      toast("Supplier ditambahkan!");
      setShowAdd(false);
      setForm({ name: "", contact: "", address: "", notes: "" });
      reload();
    } catch (e) { toast("Gagal: " + e.message, "error"); }
    setSaving(false);
  };

  const del = async (id, name) => {
    if (!confirm(`Hapus supplier "${name}"?`)) return;
    try {
      await api(`/suppliers/${id}`, { method: "DELETE" });
      toast("Supplier dihapus");
      reload();
    } catch (e) { toast("Gagal: " + e.message, "error"); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🏪 Supplier</h1>
        <Btn onClick={() => setShowAdd(true)}>＋ Tambah Supplier</Btn>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon="🏪" title="Belum ada supplier" sub="Tambah pemasok untuk memudahkan pencatatan" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                <button onClick={() => del(s.id, s.name)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13 }}>🗑️</button>
              </div>
              {s.contact && <div style={{ fontSize: 12, color: "var(--muted)" }}>📞 {s.contact}</div>}
              {s.address && <div style={{ fontSize: 12, color: "var(--muted)" }}>📍 {s.address}</div>}
              {s.notes && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Supplier Baru">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Nama Supplier *" placeholder="cth: Pasar Induk" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Kontak (HP/WA)" placeholder="08xx..." value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} />
          <Input label="Alamat" placeholder="Alamat lengkap" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          <Input label="Catatan" placeholder="Catatan tambahan" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowAdd(false)}>Batal</Btn>
            <Btn onClick={add} disabled={saving || !form.name.trim()}>{saving ? "..." : "Simpan"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "dashboard", icon: "📊", label: "Dashboard" },
  { key: "add", icon: "➕", label: "Tambah" },
  { key: "transactions", icon: "📂", label: "Riwayat" },
  { key: "reports", icon: "📈", label: "Laporan" },
  { key: "search", icon: "🔍", label: "Cari" },
  { key: "suppliers", icon: "🏪", label: "Supplier" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [suppliers, setSuppliers] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);

  const toast = (msg, type = "success") => setToastMsg({ msg, type });

  const loadSuppliers = useCallback(() => {
    api("/suppliers").then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
        :root {
          --bg: #f7f5f2;
          --bg-raised: #efece8;
          --card: #ffffff;
          --text: #1a1a1a;
          --muted: #8c8578;
          --border: #e2ddd5;
          --accent: #c05e3c;
          --accent-light: #f2e0d8;
          --sidebar: #2c2825;
          --sidebar-text: #c9c2b8;
          --sidebar-active: #c05e3c;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #1a1816;
            --bg-raised: #242220;
            --card: #2a2826;
            --text: #e8e2da;
            --muted: #8c8578;
            --border: #3a3632;
            --accent: #e07a5f;
            --accent-light: #3d2e28;
            --sidebar: #141210;
            --sidebar-text: #8c8578;
            --sidebar-active: #e07a5f;
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }
        input:focus, select:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-light); }
        ::selection { background: var(--accent-light); }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, background: "var(--sidebar)", padding: "24px 12px",
          display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
          position: "sticky", top: 0, height: "100vh", overflowY: "auto",
        }}>
          <div style={{
            padding: "8px 12px", marginBottom: 20, textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🍳</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Catering Tracker</div>
            <div style={{ fontSize: 10, color: "var(--sidebar-text)", marginTop: 2 }}>Monitoring Biaya Bahan</div>
          </div>

          {NAV_ITEMS.map(n => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              width: "100%", textAlign: "left", fontSize: 13, fontWeight: page === n.key ? 700 : 500,
              background: page === n.key ? "rgba(192,94,60,0.15)" : "transparent",
              color: page === n.key ? "var(--sidebar-active)" : "var(--sidebar-text)",
              transition: "all .15s",
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          <div style={{ marginTop: "auto", padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 10, color: "var(--sidebar-text)", textAlign: "center" }}>
              File-Based Data Management
              <br />MVP v1.0
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: "28px 36px", maxWidth: 1100, overflowY: "auto" }}>
          {page === "dashboard" && <DashboardPage onNav={setPage} />}
          {page === "add" && <AddTransactionPage onNav={setPage} suppliers={suppliers} toast={toast} />}
          {page === "transactions" && <TransactionsPage toast={toast} />}
          {page === "reports" && <ReportsPage />}
          {page === "search" && <SearchPage />}
          {page === "suppliers" && <SuppliersPage suppliers={suppliers} reload={loadSuppliers} toast={toast} />}
        </main>
      </div>

      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
    </>
  );
}
