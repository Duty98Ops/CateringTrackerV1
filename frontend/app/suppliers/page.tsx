"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { fetchSuppliers, addSupplier, deleteSupplier } from "@/lib/api";
import type { Supplier } from "@/lib/types";
import { supplierSchema, type SupplierFormData } from "@/lib/schemas";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchSuppliers()
      .then(setSuppliers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus supplier "${name}"?`)) return;
    try {
      await deleteSupplier(id);
      setToast({ msg: "Supplier dihapus", type: "success" });
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
        <h1 className="text-2xl font-extrabold tracking-tight">🏪 Supplier</h1>
        <Button onClick={() => setShowAdd(true)}>＋ Tambah Supplier</Button>
      </div>

      {suppliers.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">🏪</span>
          <p className="text-lg font-bold">Belum ada supplier</p>
          <p className="text-sm text-muted-foreground">
            Tambah pemasok untuk memudahkan pencatatan
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id}>
              <div className="mb-2 flex items-start justify-between">
                <p className="break-words pr-2 text-[15px] font-bold">{s.name}</p>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  className="shrink-0 text-[13px] text-destructive hover:text-destructive/80"
                >
                  🗑️
                </button>
              </div>
              {s.contact && <p className="break-words text-xs text-muted-foreground">📞 {s.contact}</p>}
              {s.address && <p className="break-words text-xs text-muted-foreground">📍 {s.address}</p>}
              {s.notes && <p className="mt-1 break-words text-xs italic text-muted-foreground">{s.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <AddSupplierModal
          saving={saving}
          onSave={async (data) => {
            setSaving(true);
            try {
              await addSupplier(data);
              setToast({ msg: "Supplier ditambahkan!", type: "success" });
              setShowAdd(false);
              load();
            } catch (e: unknown) {
              setToast({ msg: "Gagal: " + (e instanceof Error ? e.message : "error"), type: "error" });
            }
            setSaving(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function AddSupplierModal({
  saving,
  onSave,
  onClose,
}: {
  saving: boolean;
  onSave: (data: SupplierFormData) => void;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contact: "", address: "", notes: "" },
  });

  const inputCls = (hasError: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring ${
      hasError ? "border-destructive bg-destructive/5" : "border-input bg-background"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Tambah Supplier Baru</h2>
          <button onClick={onClose} className="text-xl text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Nama Supplier *</label>
            <input placeholder="cth: Pasar Induk" {...register("name")} className={inputCls(!!errors.name)} />
            {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Kontak (HP/WA)</label>
            <input placeholder="08xx..." {...register("contact")} className={inputCls(!!errors.contact)} />
            {errors.contact && <p className="text-[11px] text-destructive">{errors.contact.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Alamat</label>
            <input placeholder="Alamat lengkap" {...register("address")} className={inputCls(!!errors.address)} />
            {errors.address && <p className="text-[11px] text-destructive">{errors.address.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Catatan</label>
            <input placeholder="Catatan tambahan" {...register("notes")} className={inputCls(!!errors.notes)} />
            {errors.notes && <p className="text-[11px] text-destructive">{errors.notes.message}</p>}
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? "..." : "Simpan"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
