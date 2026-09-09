import { z } from "zod";

// ── Transaction Item Schema ────────────────────────────────

export const itemSchema = z.object({
  name: z
    .string()
    .min(1, "Nama bahan wajib diisi")
    .max(100, "Nama terlalu panjang"),
  quantity: z
    .string()
    .min(1, "Jumlah wajib diisi")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "Jumlah harus lebih dari 0",
    }),
  unit: z.string().min(1, "Satuan wajib dipilih"),
  price_per_unit: z
    .string()
    .min(1, "Harga wajib diisi")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "Harga harus lebih dari 0",
    }),
  category: z.string().min(1, "Kategori wajib dipilih"),
});

export const transactionSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi").regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  supplier_id: z.string(),
  items: z
    .array(itemSchema)
    .min(1, "Minimal 1 item harus diisi")
    .refine(
      (items) =>
        items.some(
          (i) =>
            i.name.trim() !== "" &&
            parseFloat(i.quantity) > 0 &&
            parseFloat(i.price_per_unit) > 0
        ),
      { message: "Minimal 1 item harus lengkap (nama, jumlah, harga)" }
    ),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
export type ItemFormData = z.infer<typeof itemSchema>;

// ── Edit Item Schema (partial — only qty and price editable inline) ──

export const editItemSchema = z.object({
  quantity: z
    .string()
    .min(1, "Wajib diisi")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "Harus > 0",
    }),
  price_per_unit: z
    .string()
    .min(1, "Wajib diisi")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "Harus > 0",
    }),
});

export type EditItemFormData = z.infer<typeof editItemSchema>;

// ── Supplier Schema ────────────────────────────────────────

export const supplierSchema = z.object({
  name: z
    .string()
    .min(1, "Nama supplier wajib diisi")
    .max(100, "Nama terlalu panjang"),
  contact: z.string().max(50),
  address: z.string().max(200),
  notes: z.string().max(200),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
