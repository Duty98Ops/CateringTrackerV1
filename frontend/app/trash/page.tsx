"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchTrash,
  restoreBulk,
  restoreItem,
  purgeBulk,
  purgeItem,
  emptyTrash,
} from "@/lib/api";
import type { TrashResponse } from "@/lib/types";
import { formatCurrency, getCategoryInfo } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

export default function TrashPage() {
  const [trash, setTrash] = useState<TrashResponse>({ bulks: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchTrash()
      .then(setTrash)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestoreBulk = async (date: string, bulkId: number) => {
    setBusy(true);
    try {
      await restoreBulk(date, bulkId);
      setToast({ msg: "Belanja dipulihkan", type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
    setBusy(false);
  };

  const handleRestoreItem = async (date: string, bulkId: number, idx: number) => {
    setBusy(true);
    try {
      await restoreItem(date, bulkId, idx);
      setToast({ msg: "Item dipulihkan", type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
    setBusy(false);
  };

  const handlePurgeBulk = async (date: string, bulkId: number) => {
    if (!confirm("Hapus permanen belanja ini? Tidak dapat dikembalikan.")) return;
    setBusy(true);
    try {
      await purgeBulk(date, bulkId);
      setToast({ msg: "Belanja dihapus permanen", type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
    setBusy(false);
  };

  const handlePurgeItem = async (date: string, bulkId: number, idx: number) => {
    if (!confirm("Hapus permanen item ini? Tidak dapat dikembalikan.")) return;
    setBusy(true);
    try {
      await purgeItem(date, bulkId, idx);
      setToast({ msg: "Item dihapus permanen", type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
    setBusy(false);
  };

  const handleEmptyTrash = async () => {
    const total = trash.bulks.length + trash.items.length;
    if (total === 0) return;
    if (!confirm(`Hapus permanen ${total} item dari sampah? Tidak dapat dikembalikan.`)) return;
    setBusy(true);
    try {
      const r = await emptyTrash();
      setToast({ msg: `Sampah dikosongkan: ${r.purged_bulks} belanja & ${r.purged_items} item dihapus`, type: "success" });
      load();
    } catch (e: unknown) {
      setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
    }
    setBusy(false);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Memuat...</div>;
  }

  const isEmpty = trash.bulks.length === 0 && trash.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">🗑️ Sampah</h1>
          <p className="text-sm text-muted-foreground">
            {isEmpty
              ? "Sampah kosong"
              : `${trash.bulks.length} belanja · ${trash.items.length} item dihapus`}
          </p>
        </div>
        {!isEmpty && (
          <Button variant="destructive" onClick={handleEmptyTrash} disabled={busy}>
            Kosongkan Sampah
          </Button>
        )}
      </div>

      {/* Info banner */}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <p className="text-sm">
          <span className="font-semibold">ℹ️ Tentang Sampah:</span>{" "}
          Item yang dihapus dari Riwayat Transaksi disimpan di sini dan tidak dihitung dalam laporan. 
          Anda dapat memulihkan atau menghapusnya secara permanen.
        </p>
      </Card>

      {isEmpty ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">✨</span>
          <p className="text-lg font-bold">Sampah kosong</p>
          <p className="text-sm text-muted-foreground">
            Tidak ada data yang dihapus
          </p>
        </Card>
      ) : (
        <>
          {/* Deleted Bulks */}
          {trash.bulks.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-bold">🛒 Belanja Dihapus ({trash.bulks.length})</h2>
              {trash.bulks.map((bulk) => (
                <Card key={`${bulk.date}-${bulk.bulk_id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold">📅 {bulk.date}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>Belanja #{bulk.bulk_id}</span>
                        {bulk.supplier_name && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">🏪 {bulk.supplier_name}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dihapus pada {bulk.deleted_at} · {bulk.item_count} item · Total {formatCurrency(bulk.total)}
                      </p>

                      {/* Item preview (collapsed) */}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-primary hover:underline">
                          Lihat {bulk.item_count} item
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 rounded-lg bg-secondary p-2">
                          {bulk.items.map((item, idx) => {
                            const cat = getCategoryInfo(item.category);
                            return (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>{cat.icon} {item.name}</span>
                                <span className="text-muted-foreground">
                                  {item.quantity} {item.unit} · {formatCurrency(item.cost)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestoreBulk(bulk.date, bulk.bulk_id)}
                        disabled={busy}
                      >
                        ↩️ Pulihkan
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handlePurgeBulk(bulk.date, bulk.bulk_id)}
                        disabled={busy}
                      >
                        Hapus Permanen
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Deleted Items */}
          {trash.items.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-bold">📦 Item Dihapus ({trash.items.length})</h2>
              {trash.items.map((item) => {
                const cat = getCategoryInfo(item.category);
                return (
                  <Card key={`${item.date}-${item.bulk_id}-${item.item_idx}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-base">{cat.icon}</span>
                          <span className="font-bold">{item.name}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.date} · {item.quantity} {item.unit} · {formatCurrency(item.cost)} · Belanja #{item.bulk_id}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Dihapus pada {item.deleted_at}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRestoreItem(item.date, item.bulk_id, item.item_idx)}
                          disabled={busy}
                        >
                          ↩️ Pulihkan
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handlePurgeItem(item.date, item.bulk_id, item.item_idx)}
                          disabled={busy}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
