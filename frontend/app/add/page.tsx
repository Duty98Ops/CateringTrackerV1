"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { addTransaction, fetchSuppliers } from "@/lib/api";
import type { Supplier } from "@/lib/types";
import { CATEGORIES, UNITS, formatCurrency, getCategoryInfo } from "@/lib/types";
import { transactionSchema, type TransactionFormData } from "@/lib/schemas";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

const emptyItem = {
  name: "",
  quantity: "",
  unit: "kg",
  price_per_unit: "",
  category: "bahan_pokok",
};

export default function AddTransactionPage() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: today,
      supplier_id: "",
      items: [{ ...emptyItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchItems = watch("items");

  const rowCost = (i: number) => {
    const row = watchItems?.[i];
    if (!row) return 0;
    return (parseFloat(row.quantity) || 0) * (parseFloat(row.price_per_unit) || 0);
  };

  const total = watchItems?.reduce((sum, _, i) => sum + rowCost(i), 0) ?? 0;
  const validCount =
    watchItems?.filter(
      (r) =>
        r.name.trim() !== "" &&
        parseFloat(r.quantity) > 0 &&
        parseFloat(r.price_per_unit) > 0
    ).length ?? 0;

  const onSubmit = async (data: TransactionFormData) => {
    setSaving(true);
    try {
      const validItems = data.items.filter(
        (r) =>
          r.name.trim() !== "" &&
          parseFloat(r.quantity) > 0 &&
          parseFloat(r.price_per_unit) > 0
      );

      await addTransaction({
        date: data.date,
        supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
        items: validItems.map((r) => ({
          name: r.name.trim(),
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          price_per_unit: parseFloat(r.price_per_unit),
          category: r.category,
        })),
      });

      setToast({ msg: "Belanja berhasil disimpan!", type: "success" });
      setTimeout(() => router.push("/transactions"), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setToast({ msg: "Gagal: " + msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring ${
      hasError ? "border-destructive bg-destructive/5" : "border-input bg-background"
    }`;

  return (
    <div className="mx-auto max-w-[850px]">
      <h1 className="text-2xl font-extrabold tracking-tight">➕ Tambah Belanja Baru</h1>
      <p className="mb-6 text-sm text-muted-foreground">Input bahan-bahan yang dibeli</p>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Date & Supplier */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex flex-1 flex-col gap-1.5 sm:flex-none">
            <label className="text-xs font-semibold text-muted-foreground">Tanggal</label>
            <input
              type="date"
              {...register("date")}
              className={inputCls(!!errors.date) + " h-10"}
            />
            {errors.date && <p className="text-[11px] text-destructive">{errors.date.message}</p>}
          </div>

          <div className="flex flex-1 flex-col gap-1.5 sm:flex-none">
            <label className="text-xs font-semibold text-muted-foreground">Supplier</label>
            <select
              {...register("supplier_id")}
              className="flex h-10 rounded-lg border border-input bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Pilih Supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Items — stacked cards on mobile, grid on desktop */}
        <Card className="mb-5">
          {/* Desktop column headers — hidden on mobile */}
          <div className="mb-2 hidden grid-cols-[2fr_1fr_90px_1.2fr_130px_32px] gap-x-2.5 px-1 text-xs font-semibold text-muted-foreground md:grid">
            <span>Nama Bahan *</span>
            <span>Jumlah *</span>
            <span>Satuan</span>
            <span>Harga/Unit *</span>
            <span>Kategori</span>
            <span />
          </div>

          {fields.map((field, i) => {
            const cost = rowCost(i);
            const itemErrors = errors.items?.[i];

            return (
              <div key={field.id} className="mb-3 md:mb-1.5">
                {/* MOBILE: stacked card layout */}
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3 md:hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Item #{i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => fields.length > 1 && remove(i)}
                      disabled={fields.length <= 1}
                      className="text-base text-destructive disabled:text-border"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Nama Bahan *</label>
                    <input
                      placeholder="cth: Ayam"
                      {...register(`items.${i}.name`)}
                      className={inputCls(!!itemErrors?.name)}
                    />
                    {itemErrors?.name && (
                      <p className="mt-0.5 text-[10px] text-destructive">{itemErrors.name.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Jumlah *</label>
                      <input
                        type="number"
                        placeholder="0"
                        step="any"
                        min="0"
                        {...register(`items.${i}.quantity`)}
                        className={inputCls(!!itemErrors?.quantity)}
                      />
                      {itemErrors?.quantity && (
                        <p className="mt-0.5 text-[10px] text-destructive">{itemErrors.quantity.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Satuan</label>
                      <select
                        {...register(`items.${i}.unit`)}
                        className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Harga / Unit *</label>
                    <input
                      type="number"
                      placeholder="Rp"
                      min="0"
                      {...register(`items.${i}.price_per_unit`)}
                      className={inputCls(!!itemErrors?.price_per_unit)}
                    />
                    {itemErrors?.price_per_unit && (
                      <p className="mt-0.5 text-[10px] text-destructive">{itemErrors.price_per_unit.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Kategori</label>
                    <select
                      {...register(`items.${i}.category`)}
                      className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </div>

                  {cost > 0 && (
                    <div className="rounded-md bg-secondary p-2 text-right text-xs">
                      Total: <span className="font-bold text-primary">{formatCurrency(cost)}</span>
                    </div>
                  )}
                </div>

                {/* DESKTOP: grid row */}
                <div
                  className={`hidden grid-cols-[2fr_1fr_90px_1.2fr_130px_32px] gap-x-2.5 rounded-lg p-2 md:grid ${
                    i % 2 === 0 ? "bg-secondary/50" : ""
                  }`}
                >
                  <div>
                    <input
                      placeholder="cth: Ayam"
                      {...register(`items.${i}.name`)}
                      className={inputCls(!!itemErrors?.name)}
                    />
                    {itemErrors?.name && (
                      <p className="mt-0.5 text-[10px] text-destructive">{itemErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="0"
                      step="any"
                      min="0"
                      {...register(`items.${i}.quantity`)}
                      className={inputCls(!!itemErrors?.quantity)}
                    />
                    {itemErrors?.quantity && (
                      <p className="mt-0.5 text-[10px] text-destructive">{itemErrors.quantity.message}</p>
                    )}
                  </div>
                  <select
                    {...register(`items.${i}.unit`)}
                    className="rounded-lg border border-input bg-background px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                  >
                    {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </select>
                  <div>
                    <input
                      type="number"
                      placeholder="Rp"
                      min="0"
                      {...register(`items.${i}.price_per_unit`)}
                      className={inputCls(!!itemErrors?.price_per_unit)}
                    />
                    {itemErrors?.price_per_unit && (
                      <p className="mt-0.5 text-[10px] text-destructive">{itemErrors.price_per_unit.message}</p>
                    )}
                  </div>
                  <select
                    {...register(`items.${i}.category`)}
                    className="rounded-lg border border-input bg-background px-2 py-2 text-[11px] outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => fields.length > 1 && remove(i)}
                    disabled={fields.length <= 1}
                    className="self-center text-base text-destructive disabled:text-border"
                  >
                    ✕
                  </button>
                </div>

                {/* Desktop cost preview line */}
                {cost > 0 && (
                  <div className="hidden pr-10 text-right text-[11px] text-muted-foreground md:block">
                    = {formatCurrency(cost)}
                  </div>
                )}
              </div>
            );
          })}

          {errors.items?.root && (
            <p className="mt-1 text-xs text-destructive">{errors.items.root.message}</p>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ ...emptyItem })}
            className="mt-2"
          >
            ＋ Tambah Baris
          </Button>
        </Card>

        {/* Footer */}
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Belanja</p>
            <p className="text-3xl font-extrabold text-primary">{formatCurrency(total)}</p>
            <p className="text-[11px] text-muted-foreground">{validCount} item valid</p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => router.push("/")}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "💾 Simpan"}
            </Button>
          </div>
        </Card>
      </form>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
