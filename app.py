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


def is_active(obj):
    """Check if a bulk or item is NOT soft-deleted."""
    return not obj.get("deleted_at")


def get_suppliers(data):
    if "suppliers" not in data:
        data["suppliers"] = {}
    return data["suppliers"]


def calculate_day_total(day_data):
    """Sum only non-deleted bulks (and only their non-deleted items)."""
    total = 0
    for b in day_data.get("bulk_inputs", []):
        if not is_active(b):
            continue
        total += sum(i.get("cost", 0) for i in b.get("items", []) if is_active(i))
    return total


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

    # Helper — active bulks for a day
    def active_bulks(d):
        return [b for b in data[d].get("bulk_inputs", []) if is_active(b)]

    def active_items(b):
        return [i for i in b.get("items", []) if is_active(i)]

    def day_total_active(d):
        if d not in data:
            return 0
        return sum(sum(i.get("cost", 0) for i in active_items(b))
                   for b in active_bulks(d))

    grand_total = sum(day_total_active(d) for d in date_keys)
    total_days = sum(1 for d in date_keys if active_bulks(d))
    total_bulks = sum(len(active_bulks(d)) for d in date_keys)
    total_items = sum(len(active_items(b)) for d in date_keys for b in active_bulks(d))

    today_total = day_total_active(today)

    # Last 7 days
    week_total = 0
    for i in range(7):
        d = (datetime.now() - timedelta(days=i)).strftime(DATE_FORMAT)
        week_total += day_total_active(d)

    # Last 30 days
    month_total = 0
    for i in range(30):
        d = (datetime.now() - timedelta(days=i)).strftime(DATE_FORMAT)
        month_total += day_total_active(d)

    # Daily totals chart (last 30 days)
    daily_chart = []
    for i in range(29, -1, -1):
        d = (datetime.now() - timedelta(days=i)).strftime(DATE_FORMAT)
        daily_chart.append({"date": d, "total": day_total_active(d)})

    # Category breakdown
    cat_totals = {}
    for d in date_keys:
        for b in active_bulks(d):
            for item in active_items(b):
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
        "total_items": total_items,
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
            if not is_active(bulk):
                continue
            # Filter out soft-deleted items
            active_items = [i for i in bulk.get("items", []) if is_active(i)]
            if not active_items:
                continue  # all items deleted — hide the bulk too
            bulk_total = sum(i.get("cost", 0) for i in active_items)
            bulks.append({
                **bulk,
                "items": active_items,
                "total": bulk_total,
                "supplier_name": supplier_name(data, bulk.get("supplier_id")),
            })
        if not bulks:
            continue  # skip days with no visible bulks

        day_total = sum(b["total"] for b in bulks)
        result.append({
            "date": d,
            "day_total": day_total,
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
            "deleted_at": None,
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
        "deleted_at": None,
    }

    data[date_str]["bulk_inputs"].append(bulk)
    data[date_str]["day_total"] = calculate_day_total(data[date_str])
    save_data(data)

    return jsonify({"success": True, "date": date_str, "bulk_id": next_id, "total": bulk_total}), 201


@app.route("/api/transactions/<date_str>/<int:bulk_id>", methods=["DELETE"])
def api_delete_transaction(date_str, bulk_id):
    """Soft-delete a bulk — mark with deleted_at instead of removing."""
    data = load_data()

    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404

    day = data[date_str]
    found = False
    for bulk in day["bulk_inputs"]:
        if bulk["id"] == bulk_id and is_active(bulk):
            bulk["deleted_at"] = datetime.now().strftime(DATETIME_FORMAT)
            found = True
            break

    if not found:
        return jsonify({"error": "Bulk not found or already deleted"}), 404

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

    if not is_active(item):
        return jsonify({"error": "Cannot edit deleted item"}), 400

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
    bulk["total"] = sum(i.get("cost", 0) for i in bulk["items"] if is_active(i))
    day["day_total"] = calculate_day_total(day)
    save_data(data)

    return jsonify({"success": True, "item": item})


@app.route("/api/transactions/<date_str>/<int:bulk_id>/items/<int:item_idx>", methods=["DELETE"])
def api_delete_item(date_str, bulk_id, item_idx):
    """Soft-delete an item — mark with deleted_at instead of removing."""
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

    item = bulk["items"][item_idx]
    if not is_active(item):
        return jsonify({"error": "Item already deleted"}), 400

    item["deleted_at"] = datetime.now().strftime(DATETIME_FORMAT)

    # Recalculate bulk total (only active items)
    bulk["total"] = sum(i.get("cost", 0) for i in bulk["items"] if is_active(i))
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
        active_bulks = [b for b in day["bulk_inputs"] if is_active(b)]
        items_count = 0
        day_total = 0
        for b in active_bulks:
            active_items = [i for i in b.get("items", []) if is_active(i)]
            items_count += len(active_items)
            day_total += sum(i.get("cost", 0) for i in active_items)

        if day_total == 0 and items_count == 0:
            continue

        total_items += items_count
        grand_total += day_total
        days.append({
            "date": d,
            "day_total": day_total,
            "bulk_count": len(active_bulks),
            "item_count": items_count,
        })

    return jsonify({
        "start": start,
        "end": end,
        "days": days,
        "grand_total": grand_total,
        "total_items": total_items,
        "days_with_data": len(days),
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
            if not is_active(bulk):
                continue
            for item in bulk.get("items", []):
                if not is_active(item):
                    continue
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

    result = [{"month": m, "total": v["total"], "days": len(v["days"]), "items": v["items"]}
              for m, v in sorted(monthly.items())]
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
            if not is_active(bulk):
                continue
            for item in bulk.get("items", []):
                if not is_active(item):
                    continue
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


# ─── Trash / Soft Delete Recovery ──────────────────────────────────────────

@app.route("/api/trash", methods=["GET"])
def api_list_trash():
    """List all soft-deleted bulks and items."""
    data = load_data()
    deleted_bulks = []
    deleted_items = []

    for d in sorted(get_date_keys(data), reverse=True):
        for bulk in data[d].get("bulk_inputs", []):
            if not is_active(bulk):
                # Whole bulk deleted
                bulk_items = bulk.get("items", [])
                deleted_bulks.append({
                    "date": d,
                    "bulk_id": bulk["id"],
                    "deleted_at": bulk.get("deleted_at"),
                    "timestamp": bulk.get("timestamp"),
                    "supplier_name": supplier_name(data, bulk.get("supplier_id")),
                    "items": bulk_items,
                    "total": sum(i.get("cost", 0) for i in bulk_items),
                    "item_count": len(bulk_items),
                })
            else:
                # Bulk is active — check for individually deleted items
                for idx, item in enumerate(bulk.get("items", [])):
                    if not is_active(item):
                        deleted_items.append({
                            "date": d,
                            "bulk_id": bulk["id"],
                            "item_idx": idx,
                            "deleted_at": item.get("deleted_at"),
                            "name": item.get("name"),
                            "quantity": item.get("quantity"),
                            "unit": item.get("unit"),
                            "price_per_unit": item.get("price_per_unit"),
                            "cost": item.get("cost"),
                            "category": item.get("category", "lainnya"),
                        })

    return jsonify({"bulks": deleted_bulks, "items": deleted_items})


@app.route("/api/trash/bulk/<date_str>/<int:bulk_id>/restore", methods=["POST"])
def api_restore_bulk(date_str, bulk_id):
    data = load_data()
    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404
    day = data[date_str]
    for bulk in day["bulk_inputs"]:
        if bulk["id"] == bulk_id and not is_active(bulk):
            bulk["deleted_at"] = None
            day["day_total"] = calculate_day_total(day)
            save_data(data)
            return jsonify({"success": True})
    return jsonify({"error": "Bulk not found or not deleted"}), 404


@app.route("/api/trash/item/<date_str>/<int:bulk_id>/<int:item_idx>/restore", methods=["POST"])
def api_restore_item(date_str, bulk_id, item_idx):
    data = load_data()
    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404
    day = data[date_str]
    for bulk in day["bulk_inputs"]:
        if bulk["id"] == bulk_id:
            if item_idx < 0 or item_idx >= len(bulk["items"]):
                return jsonify({"error": "Item index out of range"}), 404
            item = bulk["items"][item_idx]
            if is_active(item):
                return jsonify({"error": "Item not deleted"}), 400
            item["deleted_at"] = None
            bulk["total"] = sum(i.get("cost", 0) for i in bulk["items"] if is_active(i))
            day["day_total"] = calculate_day_total(day)
            save_data(data)
            return jsonify({"success": True})
    return jsonify({"error": "Bulk not found"}), 404


@app.route("/api/trash/bulk/<date_str>/<int:bulk_id>", methods=["DELETE"])
def api_purge_bulk(date_str, bulk_id):
    """Permanently delete a soft-deleted bulk."""
    data = load_data()
    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404
    day = data[date_str]
    for i, bulk in enumerate(day["bulk_inputs"]):
        if bulk["id"] == bulk_id and not is_active(bulk):
            day["bulk_inputs"].pop(i)
            if not day["bulk_inputs"]:
                del data[date_str]
            else:
                day["day_total"] = calculate_day_total(day)
            save_data(data)
            return jsonify({"success": True})
    return jsonify({"error": "Bulk not found in trash"}), 404


@app.route("/api/trash/item/<date_str>/<int:bulk_id>/<int:item_idx>", methods=["DELETE"])
def api_purge_item(date_str, bulk_id, item_idx):
    """Permanently delete a soft-deleted item."""
    data = load_data()
    if date_str not in data:
        return jsonify({"error": "Date not found"}), 404
    day = data[date_str]
    for bulk in day["bulk_inputs"]:
        if bulk["id"] == bulk_id:
            if item_idx < 0 or item_idx >= len(bulk["items"]):
                return jsonify({"error": "Item index out of range"}), 404
            item = bulk["items"][item_idx]
            if is_active(item):
                return jsonify({"error": "Item not deleted"}), 400
            bulk["items"].pop(item_idx)
            # Clean up if bulk now has no items at all
            if not bulk["items"]:
                day["bulk_inputs"].remove(bulk)
                if not day["bulk_inputs"]:
                    del data[date_str]
            save_data(data)
            return jsonify({"success": True})
    return jsonify({"error": "Bulk not found"}), 404


@app.route("/api/trash/empty", methods=["DELETE"])
def api_empty_trash():
    """Permanently delete all soft-deleted items and bulks."""
    data = load_data()
    purged_bulks = 0
    purged_items = 0

    for d in list(get_date_keys(data)):
        day = data[d]
        # Remove deleted bulks
        new_bulks = []
        for bulk in day.get("bulk_inputs", []):
            if not is_active(bulk):
                purged_bulks += 1
                continue
            # Remove deleted items within active bulks
            new_items = []
            for item in bulk.get("items", []):
                if not is_active(item):
                    purged_items += 1
                    continue
                new_items.append(item)
            bulk["items"] = new_items
            if new_items:
                new_bulks.append(bulk)
        day["bulk_inputs"] = new_bulks
        if not new_bulks:
            del data[d]

    save_data(data)
    return jsonify({"success": True, "purged_bulks": purged_bulks, "purged_items": purged_items})


# ─── Forecast / Price Prediction ───────────────────────────────────────────

@app.route("/api/forecast", methods=["GET"])
def api_forecast():
    """
    Forecast future prices for an item using linear regression.
    Query params:
      item — exact item name (case-insensitive, word boundary)
      periods — how many future points to predict (default 5)
    """
    import re

    item_query = request.args.get("item", "").strip().lower()
    periods = int(request.args.get("periods", 5))

    if not item_query:
        return jsonify({"error": "item parameter required"}), 400

    data = load_data()
    history = []

    for d in sorted(get_date_keys(data)):
        for bulk in data[d].get("bulk_inputs", []):
            if not is_active(bulk):
                continue
            for item in bulk.get("items", []):
                if not is_active(item):
                    continue
                if item["name"].strip().lower() == item_query:
                    history.append({
                        "date": d,
                        "price": item.get("price_per_unit", 0),
                    })

    if len(history) < 2:
        return jsonify({
            "history": history,
            "forecast": [],
            "summary": None,
            "message": "Butuh minimal 2 data harga untuk prediksi"
        })

    # Build numeric x-axis (days since first purchase)
    base_date = datetime.strptime(history[0]["date"], DATE_FORMAT)
    xs = []
    ys = []
    for h in history:
        d = datetime.strptime(h["date"], DATE_FORMAT)
        xs.append((d - base_date).days)
        ys.append(h["price"])

    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    # Linear regression: slope (m) and intercept (b)
    numerator = sum((xs[i] - mean_x) * (ys[i] - mean_y) for i in range(n))
    denominator = sum((xs[i] - mean_x) ** 2 for i in range(n))

    if denominator == 0:
        slope = 0
    else:
        slope = numerator / denominator
    intercept = mean_y - slope * mean_x

    # R-squared (goodness of fit)
    ss_tot = sum((y - mean_y) ** 2 for y in ys)
    ss_res = sum((ys[i] - (slope * xs[i] + intercept)) ** 2 for i in range(n))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    # Moving average (last 3 points) as a complementary indicator
    last_n = ys[-3:] if len(ys) >= 3 else ys
    moving_avg = sum(last_n) / len(last_n)

    # Forecast next N periods, spacing them by the average interval between purchases
    if n > 1:
        intervals = [xs[i+1] - xs[i] for i in range(n-1)]
        avg_interval = max(1, round(sum(intervals) / len(intervals)))
    else:
        avg_interval = 7  # default weekly

    last_x = xs[-1]
    last_date = datetime.strptime(history[-1]["date"], DATE_FORMAT)
    forecast = []
    for i in range(1, periods + 1):
        future_x = last_x + i * avg_interval
        future_date = last_date + timedelta(days=i * avg_interval)
        predicted = max(0, slope * future_x + intercept)  # don't predict negative
        forecast.append({
            "date": future_date.strftime(DATE_FORMAT),
            "price": round(predicted, 2),
        })

    # Trend description
    if abs(slope) < 0.01:
        trend = "stabil"
    elif slope > 0:
        trend = "naik"
    else:
        trend = "turun"

    # Price change per typical interval
    change_per_interval = slope * avg_interval
    change_pct = (change_per_interval / mean_y * 100) if mean_y > 0 else 0

    return jsonify({
        "history": history,
        "forecast": forecast,
        "summary": {
            "trend": trend,
            "slope_per_day": round(slope, 4),
            "change_per_interval": round(change_per_interval, 2),
            "change_pct_per_interval": round(change_pct, 2),
            "r_squared": round(r_squared, 3),
            "avg_interval_days": avg_interval,
            "moving_avg_last_3": round(moving_avg, 2),
            "data_points": n,
        }
    })




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
        # Recompute day_total using only active items
        day_total_active = sum(
            sum(i.get("cost", 0) for i in b.get("items", []) if is_active(i))
            for b in day.get("bulk_inputs", []) if is_active(b)
        )
        day_total_written = False
        for bulk in day.get("bulk_inputs", []):
            if not is_active(bulk):
                continue
            sup = supplier_name(data, bulk.get("supplier_id")) or ""
            for item in bulk.get("items", []):
                if not is_active(item):
                    continue
                writer.writerow([
                    d, bulk.get("id", ""), sup, bulk.get("timestamp", ""),
                    item.get("name", ""),
                    category_label(item.get("category", "lainnya"))["label"],
                    item.get("quantity", ""), item.get("unit", ""),
                    item.get("price_per_unit", ""), item.get("cost", ""),
                    day_total_active if not day_total_written else ""
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
