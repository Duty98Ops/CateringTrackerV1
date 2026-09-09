"""
Flask API wrapper for Catering Ingredient Cost Tracker.
Exposes the JSON file-based data operations as REST endpoints.
"""

import json
import os
import csv
import io
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import uuid

# ============================================================================
# CONFIG
# ============================================================================
app = Flask(__name__, static_folder="static")
CORS(app)


@app.route("/")
def serve_frontend():
    return send_from_directory("static", "index.html")

DATA_FILE = "data/catering_costs.json"
BACKUP_DIR = "data/backups"
DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"

ITEM_CATEGORIES = [
    {"key": "bahan_pokok",  "label": "Bahan Pokok",      "icon": "🌾"},
    {"key": "daging",       "label": "Daging & Seafood", "icon": "🥩"},
    {"key": "sayuran",      "label": "Sayuran & Buah",   "icon": "🥬"},
    {"key": "bumbu",        "label": "Bumbu & Rempah",   "icon": "🧄"},
    {"key": "susu_telur",   "label": "Susu & Telur",     "icon": "🥚"},
    {"key": "minuman",      "label": "Minuman",          "icon": "🧃"},
    {"key": "packaging",    "label": "Packaging",        "icon": "📦"},
    {"key": "gas_listrik",  "label": "Gas & Utilitas",   "icon": "🔥"},
    {"key": "lainnya",      "label": "Lainnya",          "icon": "📌"},
]

COMMON_UNITS = [
    "kg", "gram", "liter", "ml", "pcs", "butir",
    "ekor", "ikat", "bungkus", "botol", "kaleng",
    "dus", "lusin", "karung"
]

# ============================================================================
# DATA HELPERS
# ============================================================================

def load_data():
    Path("data").mkdir(exist_ok=True)
    if Path(DATA_FILE).exists():
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_data(data):
    Path("data").mkdir(exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_date_keys(data):
    SKIP = {"suppliers"}
    return [k for k in data if k not in SKIP]


def get_suppliers(data):
    if "suppliers" not in data:
        data["suppliers"] = {}
    return data["suppliers"]


def calculate_day_total(day_data):
    return sum(b.get("total", 0) for b in day_data.get("bulk_inputs", []))


def category_label(key):
    for c in ITEM_CATEGORIES:
        if c["key"] == key:
            return c
    return {"key": "lainnya", "label": "Lainnya", "icon": "📌"}


def supplier_name(data, supplier_id):
    if not supplier_id:
        return None
    suppliers = get_suppliers(data)
    s = suppliers.get(str(supplier_id))
    return s["name"] if s else None


# ============================================================================
# API ROUTES
# ============================================================================

# ─── Meta ──────────────────────────────────────────────────────────────────

@app.route("/api/categories", methods=["GET"])
def api_categories():
    return jsonify(ITEM_CATEGORIES)


@app.route("/api/units", methods=["GET"])
def api_units():
    return jsonify(COMMON_UNITS)


# ─── Dashboard ─────────────────────────────────────────────────────────────

@app.route("/api/dashboard", methods=["GET"])
def api_dashboard():
    data = load_data()
    date_keys = get_date_keys(data)
    today = datetime.now().strftime(DATE_FORMAT)

    grand_total = sum(data[d]["day_total"] for d in date_keys)
    total_days = len(date_keys)
    total_bulks = sum(len(data[d]["bulk_inputs"]) for d in date_keys)
    total_items = sum(
        len(item)
        for d in date_keys
        for bulk in data[d]["bulk_inputs"]
        for item in [bulk["items"]]
    )
    today_total = data[today]["day_total"] if today in data else 0

    # Last 7 days
    week_total = 0
    for i in range(7):
        d = (datetime.now() - timedelta(days=i)).strftime(DATE_FORMAT)
        if d in data:
            week_total += data[d]["day_total"]

    # Last 30 days
    month_total = 0
    for i in range(30):
        d = (datetime.now() - timedelta(days=i)).strftime(DATE_FORMAT)
        if d in data:
            month_total += data[d]["day_total"]

    # Daily totals for chart (last 30 days)
    daily_chart = []
    for i in range(29, -1, -1):
        d = (datetime.now() - timedelta(days=i)).strftime(DATE_FORMAT)
        daily_chart.append({
            "date": d,
            "total": data[d]["day_total"] if d in data else 0
        })

    # Category breakdown
    cat_totals = {}
    for d in date_keys:
        for bulk in data[d]["bulk_inputs"]:
            for item in bulk["items"]:
                cat = item.get("category", "lainnya")
                cat_totals[cat] = cat_totals.get(cat, 0) + item.get("cost", 0)

    category_chart = []
    for c in ITEM_CATEGORIES:
        total = cat_totals.get(c["key"], 0)
        if total > 0:
            category_chart.append({
                "key": c["key"],
                "label": c["label"],
                "icon": c["icon"],
                "total": total
            })
    category_chart.sort(key=lambda x: x["total"], reverse=True)

    return jsonify({
        "today": today,
        "today_total": today_total,
        "week_total": week_total,
        "month_total": month_total,
        "grand_total": grand_total,
        "total_days": total_days,
        "total_bulks": total_bulks,
        "total_items": sum(len(bulk["items"]) for d in date_keys for bulk in data[d]["bulk_inputs"]),
        "avg_daily": grand_total / total_days if total_days else 0,
        "daily_chart": daily_chart,
        "category_chart": category_chart,
    })


# ─── Transactions ──────────────────────────────────────────────────────────

@app.route("/api/transactions", methods=["GET"])
def api_list_transactions():
    data = load_data()
    date_keys = sorted(get_date_keys(data), reverse=True)

    start = request.args.get("start")
    end = request.args.get("end")

    if start:
        date_keys = [d for d in date_keys if d >= start]
    if end:
        date_keys = [d for d in date_keys if d <= end]

    result = []
    for d in date_keys:
        day = data[d]
        bulks = []
        for bulk in day["bulk_inputs"]:
            bulks.append({
                **bulk,
                "supplier_name": supplier_name(data, bulk.get("supplier_id")),
            })
        result.append({
            "date": d,
            "day_total": day["day_total"],
            "bulk_inputs": bulks,
        })

    return jsonify(result)


@app.route("/api/transactions", methods=["POST"])
def api_add_transaction():
    data = load_data()
    body = request.json

    date_str = body.get("date", datetime.now().strftime(DATE_FORMAT))
    items = body.get("items", [])
    supplier_id = body.get("supplier_id")

    if not items:
        return jsonify({"error": "No items provided"}), 400

    # Validate & calculate
    processed_items = []
    bulk_total = 0
    for item in items:
        name = item.get("name", "").strip()
        qty = float(item.get("quantity", 0))
        unit = item.get("unit", "pcs")
        price = float(item.get("price_per_unit", 0))
        category = item.get("category", "lainnya")

        if not name or qty <= 0 or price <= 0:
            continue

        cost = qty * price
        bulk_total += cost
        processed_items.append({
            "name": name,
            "quantity": qty,
            "unit": unit,
            "price_per_unit": price,
            "cost": cost,
            "category": category,
        })

    if not processed_items:
        return jsonify({"error": "No valid items"}), 400

    # Init day
    if date_str not in data:
        data[date_str] = {"bulk_inputs": [], "day_total": 0}

    existing_ids = [b["id"] for b in data[date_str]["bulk_inputs"]]
    next_id = max(existing_ids) + 1 if existing_ids else 1

    bulk = {
        "id": next_id,
        "supplier_id": supplier_id,
        "timestamp": datetime.now().strftime(DATETIME_FORMAT),
        "items": processed_items,
        "total": bulk_total,
    }

    data[date_str]["bulk_inputs"].append(bulk)
    data[date_str]["day_total"] = calculate_day_total(data[date_str])
    save_data(data)

    return jsonify({"success": True, "date": date_str, "bulk_id": next_id, "total": bulk_total}), 201


@app.route("/api/transactions/<date_str>/<int:bulk_id>", methods=["DELETE"])
def api_delete_transaction(date_str, bulk_id):
    data = load_data()

    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404

    day = data[date_str]
    found = False
    for i, bulk in enumerate(day["bulk_inputs"]):
        if bulk["id"] == bulk_id:
            day["bulk_inputs"].pop(i)
            found = True
            break

    if not found:
        return jsonify({"error": "Bulk not found"}), 404

    if not day["bulk_inputs"]:
        del data[date_str]
    else:
        day["day_total"] = calculate_day_total(day)

    save_data(data)
    return jsonify({"success": True})


@app.route("/api/transactions/<date_str>/<int:bulk_id>/items/<int:item_idx>", methods=["PUT"])
def api_edit_item(date_str, bulk_id, item_idx):
    data = load_data()

    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404

    day = data[date_str]
    bulk = None
    for b in day["bulk_inputs"]:
        if b["id"] == bulk_id:
            bulk = b
            break

    if not bulk:
        return jsonify({"error": "Bulk not found"}), 404

    if item_idx < 0 or item_idx >= len(bulk["items"]):
        return jsonify({"error": "Item index out of range"}), 404

    body = request.json
    item = bulk["items"][item_idx]

    if "name" in body:
        item["name"] = body["name"]
    if "quantity" in body:
        item["quantity"] = float(body["quantity"])
    if "unit" in body:
        item["unit"] = body["unit"]
    if "price_per_unit" in body:
        item["price_per_unit"] = float(body["price_per_unit"])
    if "category" in body:
        item["category"] = body["category"]

    item["cost"] = item["quantity"] * item["price_per_unit"]
    bulk["total"] = sum(i["cost"] for i in bulk["items"])
    day["day_total"] = calculate_day_total(day)
    save_data(data)

    return jsonify({"success": True, "item": item})


@app.route("/api/transactions/<date_str>/<int:bulk_id>/items/<int:item_idx>", methods=["DELETE"])
def api_delete_item(date_str, bulk_id, item_idx):
    data = load_data()

    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404

    day = data[date_str]
    bulk = None
    bulk_i = None
    for i, b in enumerate(day["bulk_inputs"]):
        if b["id"] == bulk_id:
            bulk = b
            bulk_i = i
            break

    if not bulk:
        return jsonify({"error": "Bulk not found"}), 404

    if item_idx < 0 or item_idx >= len(bulk["items"]):
        return jsonify({"error": "Item index out of range"}), 404

    bulk["items"].pop(item_idx)

    if not bulk["items"]:
        day["bulk_inputs"].pop(bulk_i)

    if not day["bulk_inputs"]:
        del data[date_str]
    else:
        bulk["total"] = sum(i["cost"] for i in bulk["items"])
        day["day_total"] = calculate_day_total(day)

    save_data(data)
    return jsonify({"success": True})


# ─── Reports ───────────────────────────────────────────────────────────────

@app.route("/api/reports/range", methods=["GET"])
def api_report_range():
    data = load_data()
    start = request.args.get("start")
    end = request.args.get("end")

    if not start or not end:
        return jsonify({"error": "start and end required"}), 400

    date_keys = sorted(get_date_keys(data))
    filtered = [d for d in date_keys if start <= d <= end]

    days = []
    grand_total = 0
    total_items = 0

    for d in filtered:
        day = data[d]
        items_count = sum(len(b["items"]) for b in day["bulk_inputs"])
        total_items += items_count
        grand_total += day["day_total"]
        days.append({
            "date": d,
            "day_total": day["day_total"],
            "bulk_count": len(day["bulk_inputs"]),
            "item_count": items_count,
        })

    return jsonify({
        "start": start,
        "end": end,
        "days": days,
        "grand_total": grand_total,
        "total_items": total_items,
        "days_with_data": len(filtered),
    })


@app.route("/api/reports/categories", methods=["GET"])
def api_report_categories():
    data = load_data()
    start = request.args.get("start", "")
    end = request.args.get("end", "")

    cat_totals = {c["key"]: {"total": 0, "count": 0} for c in ITEM_CATEGORIES}

    for d in sorted(get_date_keys(data)):
        if start and d < start:
            continue
        if end and d > end:
            continue
        for bulk in data[d].get("bulk_inputs", []):
            for item in bulk.get("items", []):
                cat = item.get("category", "lainnya")
                if cat not in cat_totals:
                    cat_totals[cat] = {"total": 0, "count": 0}
                cat_totals[cat]["total"] += item.get("cost", 0)
                cat_totals[cat]["count"] += 1

    result = []
    for c in ITEM_CATEGORIES:
        t = cat_totals.get(c["key"], {"total": 0, "count": 0})
        if t["total"] > 0:
            result.append({**c, **t})

    result.sort(key=lambda x: x["total"], reverse=True)
    return jsonify(result)


@app.route("/api/reports/monthly", methods=["GET"])
def api_report_monthly():
    data = load_data()

    monthly = {}
    for d in sorted(get_date_keys(data)):
        month = d[:7]
        if month not in monthly:
            monthly[month] = {"total": 0, "days": 0, "items": 0}
        monthly[month]["total"] += data[d]["day_total"]
        monthly[month]["days"] += 1
        for bulk in data[d]["bulk_inputs"]:
            monthly[month]["items"] += len(bulk["items"])

    result = [{"month": m, **v} for m, v in sorted(monthly.items())]
    return jsonify(result)


# ─── Search ────────────────────────────────────────────────────────────────

@app.route("/api/search", methods=["GET"])
def api_search():
    import re

    data = load_data()
    q = request.args.get("q", "").lower().strip()

    if not q:
        return jsonify({"results": [], "groups": []})

    # Word-boundary match: "ayam" matches "Ayam Potong" but NOT "Bayam"
    pattern = re.compile(r'\b' + re.escape(q) + r'\b', re.IGNORECASE)

    results = []
    for d in sorted(get_date_keys(data)):
        for bulk in data[d].get("bulk_inputs", []):
            for item in bulk.get("items", []):
                if pattern.search(item["name"]):
                    results.append({
                        "date": d,
                        "bulk_id": bulk["id"],
                        "name": item["name"],
                        "quantity": item.get("quantity", 1),
                        "unit": item.get("unit", "pcs"),
                        "price_per_unit": item.get("price_per_unit", item["cost"]),
                        "cost": item["cost"],
                        "category": item.get("category", "lainnya"),
                    })

    # Group by normalized item name so "Daging Sapi" and "Iga Sapi" are separate
    groups = {}
    for r in results:
        key = r["name"].strip().lower()
        if key not in groups:
            groups[key] = {
                "name": r["name"],
                "entries": [],
                "total_cost": 0,
                "total_qty": 0,
                "unit": r["unit"],
                "min_price": r["price_per_unit"],
                "max_price": r["price_per_unit"],
                "count": 0,
            }
        g = groups[key]
        g["entries"].append(r)
        g["total_cost"] += r["cost"]
        g["total_qty"] += r["quantity"]
        g["count"] += 1
        g["min_price"] = min(g["min_price"], r["price_per_unit"])
        g["max_price"] = max(g["max_price"], r["price_per_unit"])

    group_list = sorted(groups.values(), key=lambda x: x["total_cost"], reverse=True)

    return jsonify({"results": results, "groups": group_list})


# ─── Suppliers ─────────────────────────────────────────────────────────────

@app.route("/api/suppliers", methods=["GET"])
def api_list_suppliers():
    data = load_data()
    suppliers = get_suppliers(data)
    result = [{"id": int(k), **v} for k, v in sorted(suppliers.items(), key=lambda x: int(x[0]))]
    return jsonify(result)


@app.route("/api/suppliers", methods=["POST"])
def api_add_supplier():
    data = load_data()
    suppliers = get_suppliers(data)
    body = request.json

    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400

    next_id = max((int(k) for k in suppliers), default=0) + 1

    suppliers[str(next_id)] = {
        "id": next_id,
        "name": name,
        "contact": body.get("contact", ""),
        "address": body.get("address", ""),
        "notes": body.get("notes", ""),
    }

    save_data(data)
    return jsonify({"success": True, "id": next_id}), 201


@app.route("/api/suppliers/<int:sid>", methods=["PUT"])
def api_edit_supplier(sid):
    data = load_data()
    suppliers = get_suppliers(data)
    key = str(sid)

    if key not in suppliers:
        return jsonify({"error": "Supplier not found"}), 404

    body = request.json
    s = suppliers[key]

    if "name" in body:
        s["name"] = body["name"]
    if "contact" in body:
        s["contact"] = body["contact"]
    if "address" in body:
        s["address"] = body["address"]
    if "notes" in body:
        s["notes"] = body["notes"]

    save_data(data)
    return jsonify({"success": True})


@app.route("/api/suppliers/<int:sid>", methods=["DELETE"])
def api_delete_supplier(sid):
    data = load_data()
    suppliers = get_suppliers(data)
    key = str(sid)

    if key not in suppliers:
        return jsonify({"error": "Supplier not found"}), 404

    del suppliers[key]
    save_data(data)
    return jsonify({"success": True})


# ─── Export ────────────────────────────────────────────────────────────────

@app.route("/api/export/csv", methods=["GET"])
def api_export_csv():
    data = load_data()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')

    writer.writerow([
        'Tanggal', 'Belanja ID', 'Supplier', 'Waktu Input',
        'Nama Bahan', 'Kategori', 'Jumlah', 'Satuan',
        'Harga per Unit', 'Total Biaya', 'Total Harian'
    ])

    for d in sorted(get_date_keys(data)):
        day = data[d]
        day_total_written = False
        for bulk in day.get("bulk_inputs", []):
            sup = supplier_name(data, bulk.get("supplier_id")) or ""
            for item in bulk.get("items", []):
                writer.writerow([
                    d, bulk.get("id", ""), sup, bulk.get("timestamp", ""),
                    item.get("name", ""),
                    category_label(item.get("category", "lainnya"))["label"],
                    item.get("quantity", ""), item.get("unit", ""),
                    item.get("price_per_unit", ""), item.get("cost", ""),
                    day["day_total"] if not day_total_written else ""
                ])
                day_total_written = True

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f"catering_export_{datetime.now().strftime('%Y%m%d')}.csv"
    )


# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    Path("data").mkdir(exist_ok=True)
    app.run(debug=True, port=5000)
