"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { fetchTransactions, deleteTransaction, deleteItem, editItem } from "@/lib/api";
import type { DayTransaction, TransactionItem } from "@/lib/types";
import { formatCurrency, getCategoryInfo } from "@/lib/types";
import { editItemSchema, type EditItemFormData } from "@/lib/schemas";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

interface EditTarget {
  date: string;
  bulkId: number;
  idx: number;
  item: TransactionItem;
}

export default function TransactionsPage() {
  const [txns, setTxns] = useState<DayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchTransactions()
      .then(setTxns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteBulk = async (date: string, bulkId: number) => {
    if (!confirm("Pindahkan belanja ini ke sampah? Anda bisa memulihkannya nanti.")) return;
    try {
      await deleteTransaction(date, bulkId);
      setToast({ msg: "Belanja dipindahkan ke sampah", type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
  };

  const handleDeleteItem = async (date: string, bulkId: number, idx: number) => {
    if (!confirm("Pindahkan item ini ke sampah? Anda bisa memulihkannya nanti.")) return;
    try {
      await deleteItem(date, bulkId, idx);
      setToast({ msg: "Item dipindahkan ke sampah", type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Memuat...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">📂 Riwayat Transaksi</h1>
          <p className="text-sm text-muted-foreground">{txns.length} hari tercatat</p>
        </div>
        <Link href="/trash" className="text-xs text-muted-foreground hover:text-primary">
          🗑️ Lihat sampah →
        </Link>
      </div>

      {txns.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">📋</span>
          <p className="text-lg font-bold">Belum ada transaksi</p>
          <p className="text-sm text-muted-foreground">Tambah belanja untuk memulai</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {txns.map((day) => {
            const isOpen = expanded === day.date;
            const totalItems = day.bulk_inputs.reduce((s, b) => s + b.items.length, 0);

            return (
              <Card key={day.date} className="overflow-hidden p-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : day.date)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📅</span>
                    <div>
                      <p className="text-[15px] font-bold">{day.date}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {day.bulk_inputs.length} belanja · {totalItems} item
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-extrabold text-primary">
                      {formatCurrency(day.day_total)}
                    </span>
                    <span
                      className="text-xs transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    >
                      ▼
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-3 py-3 md:px-5">
                    {day.bulk_inputs.map((bulk) => (
                      <div key={bulk.id} className="mb-4 last:mb-0">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[13px] font-semibold">
                            🛒 Belanja #{bulk.id}
                            {bulk.supplier_name && (
                              <span className="ml-2 font-normal text-muted-foreground">
                                · 🏪 {bulk.supplier_name}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteBulk(day.date, bulk.id)}
                          >
                            🗑️ Sampah
                          </Button>
                        </div>

                        {/* MOBILE: stacked item cards */}
                        <div className="flex flex-col gap-2 md:hidden">
                          {bulk.items.map((item, idx) => {
                            const cat = getCategoryInfo(item.category);
                            return (
                              <div key={idx} className="rounded-lg border border-border p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1 text-sm font-semibold">
                                    <span className="mr-1">{cat.icon}</span>{item.name}
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <button
                                      onClick={() =>
                                        setEditTarget({ date: day.date, bulkId: bulk.id, idx, item })
                                      }
                                      className="text-base text-primary"
                                      title="Edit"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(day.date, bulk.id, idx)}
                                      className="text-base text-destructive"
                                      title="Hapus"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    {item.quantity} {item.unit} × {formatCurrency(item.price_per_unit)}
                                  </span>
                                  <span className="font-bold">{formatCurrency(item.cost)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* DESKTOP: table */}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="py-1.5 pl-2 pr-3 text-left text-[11px] font-semibold text-muted-foreground">Bahan</th>
                                <th className="px-3 py-1.5 text-right text-[11px] font-semibold text-muted-foreground">Jumlah</th>
                                <th className="px-3 py-1.5 text-right text-[11px] font-semibold text-muted-foreground">Harga/Unit</th>
                                <th className="px-3 py-1.5 text-right text-[11px] font-semibold text-muted-foreground">Total</th>
                                <th className="w-20" />
                              </tr>
                            </thead>
                            <tbody>
                              {bulk.items.map((item, idx) => {
                                const cat = getCategoryInfo(item.category);
                                return (
                                  <tr key={idx} className="border-b border-border last:border-0">
                                    <td className="py-2 pl-2 pr-3">
                                      <span className="mr-1">{cat.icon}</span>{item.name}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                                      {item.quantity} {item.unit}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                                      {formatCurrency(item.price_per_unit)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                                      {formatCurrency(item.cost)}
                                    </td>
                                    <td className="py-2 pr-2 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => setEditTarget({ date: day.date, bulkId: bulk.id, idx, item })}
                                          className="text-xs text-primary hover:text-primary/80"
                                          title="Edit"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => handleDeleteItem(day.date, bulk.id, idx)}
                                          className="text-xs text-destructive hover:text-destructive/80"
                                          title="Hapus"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <p className="mt-2 text-right text-sm font-bold">
                          Subtotal: {formatCurrency(bulk.total)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {editTarget && (
        <EditItemModal
          target={editTarget}
          saving={saving}
          onSave={async (data) => {
            setSaving(true);
            try {
              await editItem(editTarget.date, editTarget.bulkId, editTarget.idx, {
                quantity: parseFloat(data.quantity),
                price_per_unit: parseFloat(data.price_per_unit),
              });
              setToast({ msg: "Item diperbarui", type: "success" });
              setEditTarget(null);
              load();
            } catch (e: unknown) {
              setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
            }
            setSaving(false);
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function EditItemModal({
  target,
  saving,
  onSave,
  onClose,
}: {
  target: EditTarget;
  saving: boolean;
  onSave: (data: EditItemFormData) => void;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditItemFormData>({
    resolver: zodResolver(editItemSchema),
    defaultValues: {
      quantity: String(target.item.quantity),
      price_per_unit: String(target.item.price_per_unit),
    },
  });

  const watchQty = watch("quantity");
  const watchPrice = watch("price_per_unit");
  const previewCost = (parseFloat(watchQty) || 0) * (parseFloat(watchPrice) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">✏️ Edit Item</h2>
          <button onClick={onClose} className="text-xl text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <p className="mb-4 text-sm font-medium">
          {getCategoryInfo(target.item.category).icon} {target.item.name}
          <span className="ml-1 text-muted-foreground">({target.item.unit})</span>
        </p>

        <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Jumlah ({target.item.unit})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              {...register("quantity")}
              className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                errors.quantity ? "border-destructive bg-destructive/5" : "border-input bg-background"
              }`}
            />
            {errors.quantity && <p className="text-[11px] text-destructive">{errors.quantity.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Harga per {target.item.unit} (Rp)
            </label>
            <input
              type="number"
              min="0"
              {...register("price_per_unit")}
              className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                errors.price_per_unit ? "border-destructive bg-destructive/5" : "border-input bg-background"
              }`}
            />
            {errors.price_per_unit && <p className="text-[11px] text-destructive">{errors.price_per_unit.message}</p>}
          </div>

          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-xs text-muted-foreground">Preview total</p>
            <p className="text-xl font-extrabold text-primary">{formatCurrency(previewCost)}</p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? "..." : "Simpan"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
