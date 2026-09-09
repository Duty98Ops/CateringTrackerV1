#!/usr/bin/env python3
"""
Pengujian performa pendekatan penyimpanan berbasis berkas JSON.

Skrip ini membangkitkan data sintetis dengan struktur yang identik dengan
berkas data/catering_costs.json, kemudian mengukur waktu operasi utama sistem
pada beberapa tingkat volume transaksi.

Operasi yang diukur:
  1. Waktu muat berkas ke memori          (load_data)
  2. Waktu simpan satu transaksi baru     (load + append + save)
  3. Waktu pembuatan laporan bulanan      (agregasi per bulan)
  4. Waktu pembuatan laporan rentang      (agregasi per hari)
  5. Waktu pencarian nama bahan baku      (pencocokan batas kata)

Logika agregasi direplikasi persis dari app.py sehingga hasil pengukuran
mencerminkan perilaku sistem yang sebenarnya.

Cara menjalankan:
    python benchmark_penyimpanan.py
    python benchmark_penyimpanan.py --skala 1000 5000 10000 --ulangan 5

Keluaran:
    - tabel hasil pada layar
    - hasil_benchmark.csv
    - hasil_benchmark.json
"""

import argparse
import csv
import json
import os
import random
import re
import statistics
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"

CATEGORIES = [
    "bahan_pokok", "daging", "sayuran", "bumbu", "susu_telur",
    "minuman", "packaging", "gas_listrik", "lainnya",
]
UNITS = ["kg", "gram", "liter", "ml", "pcs", "butir", "ekor", "ikat", "bungkus"]
NAMES = [
    "Beras", "Ayam Potong", "Daging Sapi", "Ikan Gurame", "Telur Ayam",
    "Minyak Goreng", "Bawang Merah", "Bawang Putih", "Cabai Merah", "Gula Pasir",
    "Tepung Terigu", "Santan Kelapa", "Kentang", "Wortel", "Bayam",
    "Kecap Manis", "Garam", "Kemiri", "Serai", "Daun Salam",
]


# ───────────────────────── logika direplikasi dari app.py ─────────────────────

def load_data(path):
    if Path(path).exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_data(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_date_keys(data):
    return [k for k in data if k not in {"suppliers"}]


def is_active(obj):
    return not obj.get("deleted_at")


def calculate_day_total(day_data):
    total = 0
    for b in day_data.get("bulk_inputs", []):
        if not is_active(b):
            continue
        total += sum(i.get("cost", 0) for i in b.get("items", []) if is_active(i))
    return total


def report_monthly(data):
    monthly = {}
    for d in sorted(get_date_keys(data)):
        for bulk in data[d]["bulk_inputs"]:
            if not is_active(bulk):
                continue
            active_items = [i for i in bulk.get("items", []) if is_active(i)]
            if not active_items:
                continue
            month = d[:7]
            if month not in monthly:
                monthly[month] = {"total": 0, "days": set(), "items": 0}
            monthly[month]["total"] += sum(i.get("cost", 0) for i in active_items)
            monthly[month]["days"].add(d)
            monthly[month]["items"] += len(active_items)
    return [
        {"month": m, "total": v["total"], "days": len(v["days"]), "items": v["items"]}
        for m, v in sorted(monthly.items())
    ]


def report_range(data, start, end):
    out = []
    for d in sorted(get_date_keys(data)):
        if not (start <= d <= end):
            continue
        bulks = [b for b in data[d].get("bulk_inputs", []) if is_active(b)]
        if not bulks:
            continue
        item_count = sum(len([i for i in b.get("items", []) if is_active(i)]) for b in bulks)
        out.append({
            "date": d,
            "day_total": calculate_day_total(data[d]),
            "bulk_count": len(bulks),
            "item_count": item_count,
        })
    return out


def search_items(data, q):
    pattern = re.compile(r"\b" + re.escape(q) + r"\b", re.IGNORECASE)
    results = []
    for d in sorted(get_date_keys(data)):
        for bulk in data[d].get("bulk_inputs", []):
            if not is_active(bulk):
                continue
            for item in bulk.get("items", []):
                if not is_active(item):
                    continue
                if pattern.search(item["name"]):
                    results.append({"date": d, "name": item["name"], "cost": item["cost"]})
    return results


# ───────────────────────── pembangkitan data sintetis ─────────────────────────

def generate_dataset(n_transaksi, transaksi_per_hari=3, item_per_transaksi=6, seed=42):
    """Membangun struktur data dengan jumlah transaksi (bulk_input) tertentu."""
    rng = random.Random(seed)
    data = {"suppliers": {}}
    for sid in range(1, 6):
        data["suppliers"][str(sid)] = {
            "id": sid,
            "name": f"Supplier {sid}",
            "contact": f"08{rng.randint(10**9, 10**10 - 1)}",
            "address": f"Pasar Blok {sid}",
            "notes": "",
        }

    tanggal = datetime(2023, 1, 1)
    dibuat = 0
    while dibuat < n_transaksi:
        key = tanggal.strftime(DATE_FORMAT)
        bulks = []
        for bid in range(1, transaksi_per_hari + 1):
            if dibuat >= n_transaksi:
                break
            items = []
            total = 0
            for _ in range(item_per_transaksi):
                qty = round(rng.uniform(1, 25), 1)
                harga = rng.randrange(5000, 150000, 500)
                cost = qty * harga
                total += cost
                items.append({
                    "name": rng.choice(NAMES),
                    "quantity": qty,
                    "unit": rng.choice(UNITS),
                    "price_per_unit": harga,
                    "cost": cost,
                    "category": rng.choice(CATEGORIES),
                    "deleted_at": None,
                })
            bulks.append({
                "id": bid,
                "supplier_id": rng.randint(1, 5),
                "timestamp": tanggal.strftime(DATETIME_FORMAT),
                "items": items,
                "total": total,
                "deleted_at": None,
            })
            dibuat += 1
        data[key] = {"bulk_inputs": bulks, "day_total": sum(b["total"] for b in bulks)}
        tanggal += timedelta(days=1)
    return data


# ───────────────────────────────── pengukuran ─────────────────────────────────

def waktu(fn, ulangan):
    """Menjalankan fn sebanyak `ulangan` kali, mengembalikan median dalam milidetik."""
    hasil = []
    for _ in range(ulangan):
        mulai = time.perf_counter()
        fn()
        hasil.append((time.perf_counter() - mulai) * 1000)
    return statistics.median(hasil)


def ukur_satu_skala(n, ulangan, workdir):
    path = os.path.join(workdir, f"data_{n}.json")
    data = generate_dataset(n)
    save_data(path, data)

    ukuran_mb = os.path.getsize(path) / (1024 * 1024)
    tanggal_keys = sorted(get_date_keys(data))
    start, end = tanggal_keys[0], tanggal_keys[-1]
    jumlah_hari = len(tanggal_keys)

    t_muat = waktu(lambda: load_data(path), ulangan)

    def simpan_satu_transaksi():
        d = load_data(path)
        key = datetime.now().strftime(DATE_FORMAT)
        if key not in d:
            d[key] = {"bulk_inputs": [], "day_total": 0}
        ids = [b["id"] for b in d[key]["bulk_inputs"]]
        next_id = max(ids) + 1 if ids else 1
        d[key]["bulk_inputs"].append({
            "id": next_id,
            "supplier_id": 1,
            "timestamp": datetime.now().strftime(DATETIME_FORMAT),
            "items": [{
                "name": "Beras", "quantity": 10, "unit": "kg",
                "price_per_unit": 14000, "cost": 140000,
                "category": "bahan_pokok", "deleted_at": None,
            }],
            "total": 140000,
            "deleted_at": None,
        })
        d[key]["day_total"] = calculate_day_total(d[key])
        tmp = path + ".tmp"
        save_data(tmp, d)
        os.replace(tmp, path)

    t_simpan = waktu(simpan_satu_transaksi, ulangan)

    dimuat = load_data(path)
    t_bulanan = waktu(lambda: report_monthly(dimuat), ulangan)
    t_rentang = waktu(lambda: report_range(dimuat, start, end), ulangan)
    t_cari = waktu(lambda: search_items(dimuat, "ayam"), ulangan)

    jumlah_item = sum(
        len(b["items"]) for d in get_date_keys(dimuat) for b in dimuat[d]["bulk_inputs"]
    )

    return {
        "transaksi": n,
        "item": jumlah_item,
        "hari": jumlah_hari,
        "ukuran_mb": round(ukuran_mb, 2),
        "muat_ms": round(t_muat, 1),
        "simpan_ms": round(t_simpan, 1),
        "laporan_bulanan_ms": round(t_bulanan, 1),
        "laporan_rentang_ms": round(t_rentang, 1),
        "pencarian_ms": round(t_cari, 1),
    }


def main():
    ap = argparse.ArgumentParser(description="Pengujian performa penyimpanan berbasis berkas JSON")
    ap.add_argument("--skala", type=int, nargs="+",
                    default=[1000, 5000, 10000, 25000, 50000, 100000],
                    help="jumlah transaksi yang diuji")
    ap.add_argument("--ulangan", type=int, default=5,
                    help="jumlah pengulangan setiap pengukuran, diambil nilai mediannya")
    ap.add_argument("--keluaran", default=".", help="direktori penyimpanan hasil")
    args = ap.parse_args()

    print("Pengujian performa penyimpanan berbasis berkas JSON")
    print(f"Waktu mulai   : {datetime.now().strftime(DATETIME_FORMAT)}")
    print(f"Skala uji     : {', '.join(str(s) for s in args.skala)} transaksi")
    print(f"Pengulangan   : {args.ulangan} kali per pengukuran (median)")
    print()

    hasil = []
    with tempfile.TemporaryDirectory() as workdir:
        for n in args.skala:
            print(f"  mengukur {n} transaksi ...", end=" ", flush=True)
            baris = ukur_satu_skala(n, args.ulangan, workdir)
            hasil.append(baris)
            print("selesai")

    header = ["Transaksi", "Item", "Hari", "Ukuran (MB)", "Muat (ms)",
              "Simpan (ms)", "Lap. Bulanan (ms)", "Lap. Rentang (ms)", "Cari (ms)"]
    kunci = ["transaksi", "item", "hari", "ukuran_mb", "muat_ms",
             "simpan_ms", "laporan_bulanan_ms", "laporan_rentang_ms", "pencarian_ms"]

    lebar = [max(len(header[i]), *(len(f"{r[kunci[i]]:,}".replace(",", ".")) for r in hasil))
             for i in range(len(header))]

    print()
    print(" | ".join(h.ljust(lebar[i]) for i, h in enumerate(header)))
    print("-+-".join("-" * w for w in lebar))
    for r in hasil:
        print(" | ".join(
            f"{r[kunci[i]]:,}".replace(",", ".").ljust(lebar[i]) for i in range(len(kunci))
        ))

    out = Path(args.keluaran)
    out.mkdir(parents=True, exist_ok=True)

    with open(out / "hasil_benchmark.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(header)
        for r in hasil:
            w.writerow([r[k] for k in kunci])

    with open(out / "hasil_benchmark.json", "w", encoding="utf-8") as f:
        json.dump({
            "waktu_pengujian": datetime.now().strftime(DATETIME_FORMAT),
            "ulangan_per_pengukuran": args.ulangan,
            "catatan": "Nilai waktu merupakan median dalam satuan milidetik.",
            "hasil": hasil,
        }, f, indent=2, ensure_ascii=False)

    print()
    print(f"Hasil disimpan pada {out / 'hasil_benchmark.csv'} dan {out / 'hasil_benchmark.json'}")
    print()
    print("Catatan untuk penulisan laporan:")
    print("  1. Cantumkan spesifikasi perangkat keras dan perangkat lunak tempat pengujian dijalankan.")
    print("  2. Tentukan ambang batas waktu respons yang dianggap masih dapat diterima pengguna.")
    print("  3. Konversikan volume transaksi pada ambang tersebut menjadi perkiraan lama operasi usaha,")
    print("     dengan asumsi jumlah transaksi harian yang diperoleh dari hasil observasi lapangan.")


if __name__ == "__main__":
    main()
