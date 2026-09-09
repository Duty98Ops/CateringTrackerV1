import json
import os
import csv
import msvcrt
import sys
import time 
from datetime import datetime, timedelta
from pathlib import Path
try:
    import voice_input as _vi
    _VOICE_ENABLED = _vi.is_available()
except ImportError:
    _VOICE_ENABLED = False
try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    _EXCEL_ENABLED = True
except ImportError:
    _EXCEL_ENABLED = False

# ============================================================================
# CONFIGURATION
# ============================================================================
DATA_FILE = "data/catering_costs.json"
DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
CURRENCY_CODE = "IDR"

# ============================================================================
# ANSI COLOR CODES FOR BETTER UI
# ========================================================1====================
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'
    WHITE = '\033[97m'
    GRAY = '\033[90m'
    BG_BLUE = '\033[44m'
    BG_GREEN = '\033[42m'

# Common units for quick selection
COMMON_UNITS = [
    ("kg", "Kilogram"),
    ("gram", "Gram"),
    ("liter", "Liter"),
    ("ml", "Mililiter"),
    ("pcs", "Pieces/Buah"),
    ("butir", "Butir (telur, dll)"),
    ("ekor", "Ekor (ayam, ikan)"),
    ("ikat", "Ikat (sayuran)"),
    ("bungkus", "Bungkus/Pack"),
    ("botol", "Botol"),
    ("kaleng", "Kaleng"),
    ("dus", "Dus/Box"),
    ("lusin", "Lusin (12 pcs)"),
    ("karung", "Karung/Sak"),
]

# Item categories
ITEM_CATEGORIES = [
    ("bahan_pokok",  "Bahan Pokok",      "🌾"),
    ("daging",       "Daging & Seafood", "🥩"),
    ("sayuran",      "Sayuran & Buah",   "🥬"),
    ("bumbu",        "Bumbu & Rempah",   "🧄"),
    ("susu_telur",   "Susu & Telur",     "🥚"),
    ("minuman",      "Minuman",          "🧃"),
    ("packaging",    "Packaging",        "📦"),
    ("gas_listrik",  "Gas & Utilitas",   "🔥"),
    ("lainnya",      "Lainnya",          "📌"),
]

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def clear_screen():
    """Clear the console screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def pause():
    """Pause and wait for user input."""
    input(f"\n  {Colors.GRAY}Tekan Enter untuk melanjutkan...{Colors.END}")

def colorize(text, color):
    """Add color to text."""
    return f"{color}{text}{Colors.END}"

def print_header(title, subtitle=""):
    """Print a formatted header with better styling."""
    clear_screen()
    width = 65
    
    # Top border with decoration
    print(f"\n  {Colors.CYAN}{'═' * width}{Colors.END}")
    print(f"  {Colors.CYAN}║{Colors.END}{Colors.BOLD}{Colors.WHITE}{title:^{width-2}}{Colors.END}{Colors.CYAN}║{Colors.END}")
    if subtitle:
        print(f"  {Colors.CYAN}║{Colors.END}{Colors.GRAY}{subtitle:^{width-2}}{Colors.END}{Colors.CYAN}║{Colors.END}")
    print(f"  {Colors.CYAN}{'═' * width}{Colors.END}")
    print()

def print_separator(char="─", width=65, color=Colors.GRAY):
    """Print a separator line."""
    print(f"  {color}{char * width}{Colors.END}")

def print_box(lines, title="", width=60, color=Colors.CYAN):
    """Print content in a box."""
    print(f"\n  {color}┌{'─' * (width-2)}┐{Colors.END}")
    if title:
        print(f"  {color}│{Colors.END} {Colors.BOLD}{title:<{width-4}}{Colors.END} {color}│{Colors.END}")
        print(f"  {color}├{'─' * (width-2)}┤{Colors.END}")
    for line in lines:
        print(f"  {color}│{Colors.END} {line:<{width-4}} {color}│{Colors.END}")
    print(f"  {color}└{'─' * (width-2)}┘{Colors.END}")

def format_currency(amount):
    """Format a number as Indonesian Rupiah."""
    # Indonesian format: Rp 1.234.567
    if amount >= 0:
        formatted = f"Rp {amount:,.0f}".replace(",", ".")
    else:
        formatted = f"-Rp {abs(amount):,.0f}".replace(",", ".")
    return formatted

def format_number(num):
    """Format number with Indonesian thousand separator."""
    return f"{num:,.0f}".replace(",", ".")

def print_success(message):
    """Print success message."""
    print(f"\n  {Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message):
    """Print error message."""
    print(f"\n  {Colors.RED}✗ {message}{Colors.END}")

def print_warning(message):
    """Print warning message."""
    print(f"\n  {Colors.YELLOW}⚠ {message}{Colors.END}")

def print_info(message):
    """Print info message."""
    print(f"\n  {Colors.CYAN}ℹ {message}{Colors.END}")

def print_menu_item(number, text, shortcut=""):
    """Print a styled menu item."""
    shortcut_text = f" {Colors.GRAY}({shortcut}){Colors.END}" if shortcut else ""
    print(f"  {Colors.CYAN}[{number}]{Colors.END} {text}{shortcut_text}")

# ============================================================================
# DATA MANAGEMENT
# ============================================================================

def load_data():
    """Load data from JSON file."""
    if Path(DATA_FILE).exists():
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            print_warning("Tidak dapat memuat file data. Memulai dari awal.")
            return {}
    return {}

def save_data(data):
    """Save data to JSON file."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except IOError as e:
        print_error(f"Error menyimpan data: {e}")
        return False

BACKUP_DIR = "data/backups"

def create_backup(data):
    """Save a timestamped copy of the current data file."""
    import shutil

    Path(BACKUP_DIR).mkdir(parents=True, exist_ok=True)

    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{BACKUP_DIR}/catering_{timestamp}.json"

    try:
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print_success(f"Backup disimpan: {backup_path}")
    except IOError as e:
        print_error(f"Gagal membuat backup: {e}")

    pause()

def restore_backup(data):
    """List available backups and restore one."""
    backup_path = Path(BACKUP_DIR)

    if not backup_path.exists():
        print_warning("Belum ada backup.")
        pause()
        return data

    backups = sorted(backup_path.glob("catering_*.json"), reverse=True)

    if not backups:
        print_warning("Belum ada file backup.")
        pause()
        return data

    print_header("♻️  RESTORE BACKUP", "Pilih backup untuk dipulihkan")

    for i, b in enumerate(backups, 1):
        size_kb = b.stat().st_size / 1024
        print(f"  {Colors.CYAN}[{i}]{Colors.END} {b.name}  {Colors.GRAY}({size_kb:.1f} KB){Colors.END}")

    print(f"  {Colors.CYAN}[0]{Colors.END} Batal")
    print()

    choice = get_valid_int(f"  {Colors.YELLOW}▶ Pilih nomor backup:{Colors.END} ", 0, len(backups))

    if choice == 0:
        return data

    chosen = backups[choice - 1]

    print_warning(f"Ini akan MENGGANTI semua data saat ini dengan {chosen.name}.")

    if not get_yes_no(f"  {Colors.RED}Lanjutkan? (y/n):{Colors.END} "):
        print_info("Dibatalkan.")
        pause()
        return data

    try:
        with open(chosen, 'r', encoding='utf-8') as f:
            restored = json.load(f)

        # Save restored data as current
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(restored, f, indent=2, ensure_ascii=False)

        print_success(f"Data berhasil dipulihkan dari {chosen.name}.")
        print_info("Restart program untuk memuat data baru.")
        pause()
        return restored

    except (json.JSONDecodeError, IOError) as e:
        print_error(f"Gagal restore: {e}")
        pause()
        return data

def manage_backups(data):
    """Backup & restore menu."""
    while True:
        print_header("💾 BACKUP & RESTORE", "Kelola cadangan data")

        # Show backup count
        backup_path = Path(BACKUP_DIR)
        backups     = sorted(backup_path.glob("catering_*.json")) if backup_path.exists() else []

        print_box(
            [f"Jumlah backup tersedia : {len(backups)}",
             f"Lokasi                 : {BACKUP_DIR}/"],
            "ℹ Info", color=Colors.CYAN
        )

        print()
        print_menu_item(1, "Buat Backup Sekarang")
        print_menu_item(2, "Restore dari Backup")
        print_menu_item(3, "Hapus Backup Lama", "simpan 5 terbaru")
        print_menu_item(4, "Kembali")
        print()

        choice = get_menu_choice(4)

        if choice == 1:
            create_backup(data)
        elif choice == 2:
            data = restore_backup(data)
        elif choice == 3:
            _prune_backups()
        else:
            return data


def _prune_backups(keep=5):
    """Delete old backups, keeping only the N most recent."""
    backup_path = Path(BACKUP_DIR)
    if not backup_path.exists():
        print_warning("Tidak ada folder backup.")
        pause()
        return

    backups = sorted(backup_path.glob("catering_*.json"), reverse=True)

    if len(backups) <= keep:
        print_info(f"Hanya ada {len(backups)} backup. Tidak ada yang dihapus.")
        pause()
        return

    to_delete = backups[keep:]

    print_warning(f"Akan menghapus {len(to_delete)} backup lama, menyimpan {keep} terbaru.")

    if not get_yes_no(f"  {Colors.RED}Lanjutkan? (y/n):{Colors.END} "):
        pause()
        return

    for b in to_delete:
        try:
            b.unlink()
        except OSError:
            pass

    print_success(f"{len(to_delete)} backup lama dihapus.")
    pause()

def calculate_day_total(day_data):
    """Calculate total cost for a day from all bulk inputs."""
    total = 0
    for bulk in day_data.get("bulk_inputs", []):
        total += bulk.get("total", 0)
    return total

def recalculate_all_totals(data):
    """Recalculate all day totals."""
    for date_key in data:
        data[date_key]["day_total"] = calculate_day_total(data[date_key])
    return data

def get_date_keys(data):
    """Return only the date-formatted keys, skipping structural keys like 'suppliers'."""
    SKIP_KEYS = {"suppliers"}
    return [k for k in data.keys() if k not in SKIP_KEYS]

# ============================================================================
# SUPPLIER MANAGEMENT
# ============================================================================

def get_suppliers(data):
    """Return the suppliers dict, creating it if absent."""
    if "suppliers" not in data:
        data["suppliers"] = {}
    return data["suppliers"]

def get_next_supplier_id(suppliers):
    """Return next integer ID for a new supplier."""
    if not suppliers:
        return 1
    return max(int(k) for k in suppliers.keys()) + 1

def supplier_label(data, supplier_id):
    """Return display name for a supplier_id, or dash if none."""
    if not supplier_id:
        return "—"
    suppliers = get_suppliers(data)
    s = suppliers.get(str(supplier_id))
    return s["name"] if s else f"[ID {supplier_id} tidak ditemukan]"

def manage_suppliers(data):
    """Supplier CRUD menu."""
    while True:
        print_header("🏪 KELOLA SUPPLIER", "Daftar pemasok / tempat belanja")

        suppliers = get_suppliers(data)

        if not suppliers:
            print_box(["Belum ada supplier terdaftar."], "ℹ Info", color=Colors.YELLOW)
        else:
            print(f"  {Colors.BOLD}{'ID':<6}{'Nama':<25}{'Kontak':<20}{'Catatan'}{Colors.END}")
            print_separator()
            for sid, s in sorted(suppliers.items(), key=lambda x: int(x[0])):
                notes_short = s.get("notes", "")[:20]
                print(f"  {sid:<6}{s['name']:<25}{s.get('contact','—'):<20}{notes_short}")
            print_separator()

        print()
        print_menu_item(1, "Tambah Supplier Baru")
        print_menu_item(2, "Edit Supplier")
        print_menu_item(3, "Hapus Supplier")
        print_menu_item(4, "Kembali")
        print()

        choice = get_menu_choice(4)

        if choice == 1:
            data = add_supplier(data)
        elif choice == 2:
            data = edit_supplier(data)
        elif choice == 3:
            data = delete_supplier(data)
        else:
            return data

def add_supplier(data):
    """Add a new supplier."""
    print_header("➕ TAMBAH SUPPLIER")

    suppliers = get_suppliers(data)
    new_id    = get_next_supplier_id(suppliers)

    name = input(f"  {Colors.WHITE}Nama supplier / pasar:{Colors.END} ").strip()
    if not name:
        print_warning("Dibatalkan.")
        pause()
        return data

    contact = input(f"  {Colors.WHITE}Kontak (HP/WA, boleh kosong):{Colors.END} ").strip()
    address = input(f"  {Colors.WHITE}Alamat (boleh kosong):{Colors.END} ").strip()
    notes   = input(f"  {Colors.WHITE}Catatan (boleh kosong):{Colors.END} ").strip()

    suppliers[str(new_id)] = {
        "id":      new_id,
        "name":    name,
        "contact": contact,
        "address": address,
        "notes":   notes,
    }

    if save_data(data):
        print_success(f"Supplier '{name}' disimpan dengan ID {new_id}.")
    else:
        print_error("Gagal menyimpan.")

    pause()
    return data

def edit_supplier(data):
    """Edit an existing supplier."""
    suppliers = get_suppliers(data)
    if not suppliers:
        print_warning("Belum ada supplier.")
        pause()
        return data

    sid = input(f"  {Colors.YELLOW}ID supplier yang diedit:{Colors.END} ").strip()
    if sid not in suppliers:
        print_error(f"ID {sid} tidak ditemukan.")
        pause()
        return data

    s = suppliers[sid]
    print(f"  {Colors.GRAY}Tekan Enter untuk tidak mengubah.{Colors.END}\n")

    new_name    = input(f"  Nama    (saat ini: {s['name']}): ").strip()
    new_contact = input(f"  Kontak  (saat ini: {s.get('contact','—')}): ").strip()
    new_address = input(f"  Alamat  (saat ini: {s.get('address','—')}): ").strip()
    new_notes   = input(f"  Catatan (saat ini: {s.get('notes','—')}): ").strip()

    if new_name:    s["name"]    = new_name
    if new_contact: s["contact"] = new_contact
    if new_address: s["address"] = new_address
    if new_notes:   s["notes"]   = new_notes

    if save_data(data):
        print_success("Supplier diperbarui.")
    else:
        print_error("Gagal menyimpan.")

    pause()
    return data

def delete_supplier(data):
    """Delete a supplier after checking for references."""
    suppliers = get_suppliers(data)
    if not suppliers:
        print_warning("Belum ada supplier.")
        pause()
        return data

    sid = input(f"  {Colors.YELLOW}ID supplier yang dihapus:{Colors.END} ").strip()
    if sid not in suppliers:
        print_error(f"ID {sid} tidak ditemukan.")
        pause()
        return data

    # Check if supplier is referenced in any bulk_input
    used_in = []
    for date_str, day_data in data.items():
        if date_str == "suppliers":
            continue
        for bulk in day_data.get("bulk_inputs", []):
            if str(bulk.get("supplier_id", "")) == sid:
                used_in.append(date_str)
                break

    if used_in:
        print_warning(
            f"Supplier ini digunakan di {len(used_in)} hari "
            f"({', '.join(used_in[:3])}{'...' if len(used_in) > 3 else ''}). "
            "Data belanja tidak akan terhapus, tapi referensi supplier akan hilang."
        )

    name = suppliers[sid]["name"]
    if get_yes_no(f"  {Colors.RED}Hapus '{name}'? (y/n):{Colors.END} "):
        del suppliers[sid]
        if save_data(data):
            print_success(f"Supplier '{name}' dihapus.")
        else:
            print_error("Gagal menyimpan.")

    pause()
    return data

def select_supplier(data):
    """
    Show supplier list and return chosen supplier_id, or None if skipped.
    Called during add_bulk_input / quick_add_item.
    """
    suppliers = get_suppliers(data)

    if not suppliers:
        print_info("Belum ada supplier. Tambah dulu atau lewati.")
        if get_yes_no(f"  {Colors.YELLOW}Tambah supplier baru sekarang? (y/n):{Colors.END} "):
            data = add_supplier(data)
            suppliers = get_suppliers(data)
        else:
            return None

    print(f"\n  {Colors.CYAN}🏪 Pilih Supplier:{Colors.END}")
    print_separator("─", 50)

    sorted_suppliers = sorted(suppliers.items(), key=lambda x: int(x[0]))
    for sid, s in sorted_suppliers:
        print(f"  {Colors.CYAN}[{sid}]{Colors.END} {s['name']}"
              + (f"  {Colors.GRAY}({s.get('contact','')}){Colors.END}" if s.get("contact") else ""))

    print(f"  {Colors.CYAN}[0]{Colors.END} Lewati / tidak diketahui")
    print_separator("─", 50)

    choice = input(f"  {Colors.YELLOW}▶ ID supplier:{Colors.END} ").strip()
    if choice == "0" or choice == "":
        return None
    if choice in suppliers:
        return int(choice)

    print_warning("ID tidak valid, supplier tidak dipilih.")
    return None

# ============================================================================
# INPUT VALIDATION
# ============================================================================

def get_valid_date(prompt=""):
    """Get a valid date from user input."""
    if not prompt:
        prompt = f"  {Colors.YELLOW}📅 Tanggal (YYYY-MM-DD){Colors.END} atau Enter untuk hari ini: "
    
    while True:
        date_str = input(prompt).strip()
        if not date_str:
            return datetime.now().strftime(DATE_FORMAT)
        try:
            datetime.strptime(date_str, DATE_FORMAT)
            return date_str
        except ValueError:
            print_error("Format tidak valid. Gunakan YYYY-MM-DD (contoh: 2024-01-15)")

def get_valid_float(prompt, allow_zero=True):
    """Get a valid positive float from user input."""
    while True:
        try:
            raw_input = input(prompt).strip()
            # Handle Indonesian number format (with dots as thousand separator)
            raw_input = raw_input.replace(".", "").replace(",", ".")
            value = float(raw_input)
            if value < 0:
                print_error("Masukkan angka positif.")
                continue
            if not allow_zero and value == 0:
                print_error("Nilai tidak boleh nol.")
                continue
            return value
        except ValueError:
            print_error("Angka tidak valid. Coba lagi.")

def get_valid_int(prompt, min_val=None, max_val=None):
    """Get a valid integer within optional bounds."""
    while True:
        try:
            raw_input = input(prompt).strip()
            raw_input = raw_input.replace(".", "").replace(",", "")
            value = int(raw_input)
            if min_val is not None and value < min_val:
                print_error(f"Masukkan angka >= {min_val}.")
                continue
            if max_val is not None and value > max_val:
                print_error(f"Masukkan angka <= {max_val}.")
                continue
            return value
        except ValueError:
            print_error("Angka tidak valid. Coba lagi.")

def get_yes_no(prompt):
    """Get a yes/no response from user."""
    while True:
        response = input(prompt).strip().lower()
        if response in ['y', 'yes', 'ya']:
            return True
        if response in ['n', 'no', 'tidak', 't']:
            return False
        print_error("Ketik 'y' untuk Ya atau 'n' untuk Tidak.")

def get_menu_choice(max_choice):
    """Get a valid menu choice."""
    return get_valid_int(f"  {Colors.YELLOW}▶ Pilihan Anda:{Colors.END} ", 1, max_choice)

def _input_watching_wake(prompt: str) -> str:
    """
    Like input() but checks wake word flag while waiting.
    On Windows uses msvcrt for non-blocking key detection.
    """
    print(prompt, end="", flush=True)
    chars = []
    while True:
        # Check wake word flag
        if _VOICE_ENABLED and _vi.wake_was_triggered():
            print()  # newline after prompt
            return "v"
        # Check if a key is waiting
        if msvcrt.kbhit():
            ch = msvcrt.getwche()  # echo the character
            if ch in ('\r', '\n'):  # Enter pressed
                print()
                return "".join(chars)
            elif ch == '\x08':  # Backspace
                if chars:
                    chars.pop()
                    print(" \b", end="", flush=True)
            elif ch == '\x03':  # Ctrl+C
                raise KeyboardInterrupt
            else:
                chars.append(ch)
        else:
            time.sleep(0.05)  # small sleep to avoid 100% CPU

def input_with_voice(text_prompt, voice_prompt="", allow_empty=False, duration=5):
    suffix = f"\n  {Colors.CYAN}[V]{Colors.END} bicara  atau ketik: " if _VOICE_ENABLED else f": "
    full_prompt = f"  {Colors.WHITE}{text_prompt}{Colors.END}" + (f"\n{suffix}" if _VOICE_ENABLED else ": ")
    while True:
        raw = _input_watching_wake(full_prompt)
        if raw.lower() in ("v", "/v", "voice") and _VOICE_ENABLED:
            spoken = _vi.listen_free_text(prompt=voice_prompt or f"🎙 Ucapkan {text_prompt}", duration=duration)
            if spoken:
                confirm = input(f"  {Colors.YELLOW}Gunakan \"{spoken}\"? (Enter=ya / ketik koreksi):{Colors.END} ").strip()
                return confirm if confirm else spoken
            print(f"  {Colors.YELLOW}Coba lagi atau ketik manual.{Colors.END}")
            continue
        if not raw and not allow_empty:
            print_error("Tidak boleh kosong.") 
            continue
        return raw

def input_number_with_voice(text_prompt, allow_zero=True, duration=5):
    suffix = f"\n  {Colors.CYAN}[V]{Colors.END} bicara angka  atau ketik: " if _VOICE_ENABLED else " "
    full_prompt = f"  {Colors.WHITE}{text_prompt}:{Colors.END}" + (f"\n{suffix}" if _VOICE_ENABLED else " ")
    while True:
        raw = _input_watching_wake(full_prompt)
        if raw.lower() in ("v", "/v", "voice") and _VOICE_ENABLED:
            number = _vi.listen_number(prompt=f"🎙 Ucapkan angka untuk {text_prompt}", duration=duration)
            if number is not None:
                if number < 0:
                    print_error("Masukkan angka positif.")
                    continue
                if not allow_zero and number == 0:
                    print_error("Nilai tidak boleh nol.")
                    continue
                confirm = input(f"  {Colors.YELLOW}Gunakan {number}? (Enter=ya / ketik koreksi):{Colors.END} ").strip()
                if not confirm:
                    return float(number)
                raw = confirm
            else:
                print(f"  {Colors.YELLOW}Coba lagi atau ketik manual.{Colors.END}")
                continue
        try:
            value = float(raw.replace(".", "").replace(",", "."))
            if value < 0:
                print_error("Masukkan angka positif.")
                continue
            if not allow_zero and value == 0:
                print_error("Nilai tidak boleh nol.")
                continue
            return value
        except ValueError:
            print_error("Angka tidak valid. Coba lagi.")

# ============================================================================
# UNIT SELECTION
# ============================================================================

def select_unit():
    """Display unit selection menu and return selected unit."""
    print(f"\n  {Colors.CYAN}📦 Pilih Satuan:{Colors.END}")
    print_separator("─", 50)
    
    # Display units in two columns
    col_width = 25
    for i in range(0, len(COMMON_UNITS), 2):
        left = f"[{i+1:2}] {COMMON_UNITS[i][1]}"
        if i + 1 < len(COMMON_UNITS):
            right = f"[{i+2:2}] {COMMON_UNITS[i+1][1]}"
        else:
            right = ""
        print(f"  {left:<{col_width}} {right}")
    
    print(f"  [{len(COMMON_UNITS)+1:2}] Lainnya (ketik manual)")
    print_separator("─", 50)
    
    choice = get_valid_int(f"  {Colors.YELLOW}▶ Pilih satuan:{Colors.END} ", 1, len(COMMON_UNITS) + 1)
    
    if choice == len(COMMON_UNITS) + 1:
        custom_unit = input(f"  {Colors.YELLOW}▶ Ketik satuan:{Colors.END} ").strip()
        return custom_unit if custom_unit else "pcs"
    else:
        return COMMON_UNITS[choice - 1][0]
    
def select_category():
    """Display category selection and return selected category key."""
    print(f"\n  {Colors.CYAN}🏷️  Pilih Kategori:{Colors.END}")
    print_separator("─", 50)

    for i, (key, label, icon) in enumerate(ITEM_CATEGORIES, 1):
        print(f"  {Colors.CYAN}[{i:2}]{Colors.END} {icon} {label}")

    print_separator("─", 50)
    choice = get_valid_int(
        f"  {Colors.YELLOW}▶ Pilih kategori:{Colors.END} ", 1, len(ITEM_CATEGORIES)
    )
    return ITEM_CATEGORIES[choice - 1][0]


def category_label(key: str) -> str:
    """Return human-readable label for a category key."""
    for k, label, icon in ITEM_CATEGORIES:
        if k == key:
            return f"{icon} {label}"
    return "📌 Lainnya"

# ============================================================================
# BULK INPUT FUNCTIONS
# ============================================================================

def add_bulk_input(data):
    """Add a new bulk ingredient input with automatic price calculation."""
    print_header("➕ TAMBAH BELANJA BARU", "Input Bahan-Bahan dengan Harga Otomatis")
    
    # Get date
    date_str = get_valid_date()
    print_info(f"Tanggal dipilih: {Colors.BOLD}{date_str}{Colors.END}")
    print_separator()
    
    # Initialize day data if needed
    if date_str not in data:
        data[date_str] = {"bulk_inputs": [], "day_total": 0}
    
    # Get next bulk ID for this day
    existing_ids = [b["id"] for b in data[date_str]["bulk_inputs"]]
    next_id = max(existing_ids) + 1 if existing_ids else 1
    
    # Create new bulk input
    supplier_id = select_supplier(data)

    bulk_input = {
        "id":          next_id,
        "supplier_id": supplier_id,
        "timestamp":   datetime.now().strftime(DATETIME_FORMAT),
        "items":       [],
        "total":       0
    }
    
    print(f"\n  {Colors.CYAN}{'─' * 60}{Colors.END}")
    print(f"  {Colors.BOLD}📝 Masukkan bahan-bahan{Colors.END}")
    print(f"  {Colors.GRAY}Ketik 'selesai' atau 'done' untuk mengakhiri{Colors.END}")
    print(f"  {Colors.CYAN}{'─' * 60}{Colors.END}")
    
    item_num = 1
    while True:
        print(f"\n  {Colors.YELLOW}━━━ Bahan #{item_num} ━━━{Colors.END}")
        name = input_with_voice("Nama bahan", "Sebutkan nama bahan")
        
        if name.lower() in ['selesai', 'done', 's', 'd']:
            if not bulk_input["items"]:
                print_warning("Belum ada bahan yang dimasukkan. Membatalkan...")
                pause()
                return data
            break
        
        if not name:
            print_error("Nama bahan tidak boleh kosong.")
            continue
        
        # Get quantity
        quantity = input_number_with_voice("Jumlah", allow_zero=False)
        
        # Get unit
        unit = select_unit()
        
       # Get price per unit
        print(f"\n  {Colors.GRAY}Harga per {unit}:{Colors.END}")
        price_per_unit = input_number_with_voice("Harga per unit (Rp)", allow_zero=False)

        # Get category
        category = select_category()

        # Calculate total cost
        total_cost = quantity * price_per_unit
        
        # Show calculation
        print(f"\n  {Colors.GREEN}┌{'─' * 50}┐{Colors.END}")
        print(f"  {Colors.GREEN}│{Colors.END} {Colors.BOLD}Kalkulasi:{Colors.END}")
        print(f"  {Colors.GREEN}│{Colors.END}   {format_number(quantity)} {unit} × {format_currency(price_per_unit)}/{unit}")
        print(f"  {Colors.GREEN}│{Colors.END}   = {Colors.BOLD}{format_currency(total_cost)}{Colors.END}")
        print(f"  {Colors.GREEN}└{'─' * 50}┘{Colors.END}")
        
        bulk_input["items"].append({
            "name":           name,
            "quantity":       quantity,
            "unit":           unit,
            "price_per_unit": price_per_unit,
            "cost":           total_cost,
            "category":       category,
        })
        bulk_input["total"] += total_cost
        
        print_success(f"{name} ditambahkan!")
        print(f"  {Colors.GRAY}Subtotal sementara: {format_currency(bulk_input['total'])}{Colors.END}")
        
        item_num += 1
    
    # Show summary
    print_header("📋 RINGKASAN BELANJA", f"Tanggal: {date_str} | Bulk #{next_id}")
    
    print(f"\n  {Colors.CYAN}┌{'─' * 60}┐{Colors.END}")
    print(f"  {Colors.CYAN}│{Colors.END} {'No':<3} {'Bahan':<20} {'Qty':<12} {'Harga':<12} {'Total':<12} {Colors.CYAN}│{Colors.END}")
    print(f"  {Colors.CYAN}├{'─' * 60}┤{Colors.END}")
    
    for i, item in enumerate(bulk_input["items"], 1):
        name_short = item['name'][:18] + ".." if len(item['name']) > 20 else item['name']
        qty_str = f"{format_number(item['quantity'])} {item['unit']}"
        price_str = format_currency(item['price_per_unit']).replace("Rp ", "")
        total_str = format_currency(item['cost']).replace("Rp ", "")
        
        print(f"  {Colors.CYAN}│{Colors.END} {i:<3} {name_short:<20} {qty_str:<12} {price_str:<12} {total_str:<12} {Colors.CYAN}│{Colors.END}")
    
    print(f"  {Colors.CYAN}├{'─' * 60}┤{Colors.END}")
    print(f"  {Colors.CYAN}│{Colors.END} {Colors.BOLD}{'TOTAL':<48}{format_currency(bulk_input['total']).replace('Rp ', ''):>11}{Colors.END} {Colors.CYAN}│{Colors.END}")
    print(f"  {Colors.CYAN}└{'─' * 60}┘{Colors.END}")
    
    # Confirm save
    print()
    if get_yes_no(f"  {Colors.YELLOW}💾 Simpan belanja ini? (y/n):{Colors.END} "):
        data[date_str]["bulk_inputs"].append(bulk_input)
        data[date_str]["day_total"] = calculate_day_total(data[date_str])
        
        if save_data(data):
            print_success("Belanja berhasil disimpan!")
        else:
            print_error("Gagal menyimpan data.")
    else:
        print_warning("Belanja dibatalkan.")
    
    pause()
    return data

# ============================================================================
# QUICK ADD FUNCTION
# ============================================================================

def quick_add_item(data):
    """Quickly add a single item to today's bulk."""
    print_header("⚡ TAMBAH CEPAT", "Tambah satu item ke hari ini")
    
    date_str = datetime.now().strftime(DATE_FORMAT)
    print_info(f"Menambahkan ke tanggal: {date_str}")
    
    # Initialize day data if needed
    if date_str not in data:
        data[date_str] = {"bulk_inputs": [], "day_total": 0}
    
    # Find or create today's bulk
    day_data = data[date_str]
    if not day_data["bulk_inputs"]:
        # Create new bulk
        bulk_input = {
            "id": 1,
            "timestamp": datetime.now().strftime(DATETIME_FORMAT),
            "items": [],
            "total": 0
        }
        day_data["bulk_inputs"].append(bulk_input)
    else:
        # Use the latest bulk
        bulk_input = day_data["bulk_inputs"][-1]
    
    print()
    name = input_with_voice("Nama bahan", "Sebutkan nama bahan")
    
    if not name:
        print_error("Dibatalkan.")
        pause()
        return data
    
    quantity = input_number_with_voice("Jumlah", allow_zero=False)
    unit = select_unit()
    price_per_unit = input_number_with_voice(f"Harga per {unit} (Rp)", allow_zero=False)
    category = select_category()   
    
    total_cost = quantity * price_per_unit
    
    bulk_input["items"].append({
        "name": name,
        "quantity": quantity,
        "unit": unit,
        "price_per_unit": price_per_unit,
        "cost": total_cost,
        "category": category
    })
    bulk_input["total"] += total_cost
    day_data["day_total"] = calculate_day_total(day_data)
    
    print(f"\n  {Colors.GREEN}┌{'─' * 45}┐{Colors.END}")
    print(f"  {Colors.GREEN}│{Colors.END} {Colors.BOLD}{name}{Colors.END}")
    print(f"  {Colors.GREEN}│{Colors.END} {format_number(quantity)} {unit} × {format_currency(price_per_unit)}/{unit}")
    print(f"  {Colors.GREEN}│{Colors.END} = {Colors.BOLD}{format_currency(total_cost)}{Colors.END}")
    print(f"  {Colors.GREEN}└{'─' * 45}┘{Colors.END}")
    
    if save_data(data):
        print_success("Item berhasil ditambahkan!")
    else:
        print_error("Gagal menyimpan data.")
    
    pause()
    return data

# ============================================================================
# VIEW/EDIT FUNCTIONS
# ============================================================================

def view_edit_menu(data):
    """View and edit bulk inputs."""
    while True:
        print_header("📂 LIHAT / EDIT DATA", "Kelola data belanja Anda")
        
        if not data:
            print_box([
                "Belum ada data.",
                "Silakan tambah belanja terlebih dahulu!"
            ], "ℹ Info", color=Colors.YELLOW)
            pause()
            return data
        
        # Show dates with data
        sorted_dates = sorted(get_date_keys(data), reverse=True)
        
        print(f"  {Colors.BOLD}Daftar Tanggal:{Colors.END}")
        print_separator()
        print(f"  {'No':<4} {'Tanggal':<15} {'Belanja':<10} {'Total':>20}")
        print_separator()
        
        for i, date_str in enumerate(sorted_dates, 1):
            day_data = data[date_str]
            bulk_count = len(day_data["bulk_inputs"])
            day_total = day_data["day_total"]
            
            # Highlight today
            if date_str == datetime.now().strftime(DATE_FORMAT):
                print(f"  {Colors.GREEN}{i:<4} {date_str:<15} {bulk_count:<10} {format_currency(day_total):>20} ← Hari ini{Colors.END}")
            else:
                print(f"  {i:<4} {date_str:<15} {bulk_count:<10} {format_currency(day_total):>20}")
        
        print_separator()
        print_menu_item(len(sorted_dates) + 1, "Kembali ke Menu Utama", "0")
        print()
        
        choice = get_menu_choice(len(sorted_dates) + 1)
        
        if choice == len(sorted_dates) + 1:
            return data
        
        selected_date = sorted_dates[choice - 1]
        data = view_day_details(data, selected_date)

def view_day_details(data, date_str):
    """View details for a specific day."""
    while True:
        print_header(f"📅 DETAIL TANGGAL: {date_str}")
        
        day_data = data[date_str]
        bulk_inputs = day_data["bulk_inputs"]
        
        if not bulk_inputs:
            print_warning("Tidak ada belanja untuk tanggal ini.")
            if get_yes_no(f"  {Colors.YELLOW}Hapus entri tanggal ini? (y/n):{Colors.END} "):
                del data[date_str]
                save_data(data)
                print_success("Entri tanggal dihapus.")
            pause()
            return data
        
        # Show all bulk inputs for this day
        for bulk in bulk_inputs:
            print(f"\n  {Colors.CYAN}╔{'═' * 58}╗{Colors.END}")
            sup_label = supplier_label(data, bulk.get("supplier_id"))
            print(f"  {Colors.CYAN}║{Colors.END} {Colors.BOLD}🛒 BELANJA #{bulk['id']}{Colors.END}"
                  f"  {Colors.GRAY}🏪 {sup_label}{Colors.END}")
            print(f"  {Colors.CYAN}║{Colors.END} {Colors.GRAY}Waktu: {bulk['timestamp']}{Colors.END}")
            print(f"  {Colors.CYAN}╠{'═' * 58}╣{Colors.END}")
            
            for item in bulk["items"]:
                name_display = item['name'][:25]
                unit = item.get('unit', 'pcs')
                qty = item.get('quantity', 1)
                price_unit = item.get('price_per_unit', item['cost'])
                
                print(f"  {Colors.CYAN}║{Colors.END}   • {name_display}")
                print(f"  {Colors.CYAN}║{Colors.END}     {Colors.GRAY}{format_number(qty)} {unit} × {format_currency(price_unit)}/{unit}{Colors.END}")
                print(f"  {Colors.CYAN}║{Colors.END}     = {Colors.GREEN}{format_currency(item['cost'])}{Colors.END}")
            
            print(f"  {Colors.CYAN}╠{'═' * 58}╣{Colors.END}")
            print(f"  {Colors.CYAN}║{Colors.END}   {Colors.BOLD}Subtotal: {format_currency(bulk['total'])}{Colors.END}")
            print(f"  {Colors.CYAN}╚{'═' * 58}╝{Colors.END}")
        
        # Day total
        print(f"\n  {Colors.GREEN}{'━' * 60}{Colors.END}")
        print(f"  {Colors.GREEN}  💰 TOTAL HARI INI: {Colors.BOLD}{format_currency(day_data['day_total'])}{Colors.END}")
        print(f"  {Colors.GREEN}{'━' * 60}{Colors.END}")
        
        print(f"\n  {Colors.BOLD}Opsi:{Colors.END}")
        print_menu_item(1, "Edit belanja")
        print_menu_item(2, "Hapus belanja")
        print_menu_item(3, "Kembali")
        print()
        
        choice = get_menu_choice(3)
        
        if choice == 1:
            data = edit_bulk_input(data, date_str)
        elif choice == 2:
            data = delete_bulk_input(data, date_str)
        else:
            return data

def edit_bulk_input(data, date_str):
    """Edit a specific bulk input."""
    day_data = data[date_str]
    bulk_inputs = day_data["bulk_inputs"]
    
    if len(bulk_inputs) == 1:
        bulk_id = bulk_inputs[0]["id"]
        print_info(f"Hanya ada Belanja #{bulk_id}")
    else:
        print(f"\n  {Colors.GRAY}ID Belanja yang tersedia: {', '.join(str(b['id']) for b in bulk_inputs)}{Colors.END}")
        bulk_id = get_valid_int(f"  {Colors.YELLOW}▶ Masukkan ID Belanja:{Colors.END} ", 1)
    
    # Find the bulk input
    bulk_idx = None
    for i, bulk in enumerate(bulk_inputs):
        if bulk["id"] == bulk_id:
            bulk_idx = i
            break
    
    if bulk_idx is None:
        print_error(f"Belanja #{bulk_id} tidak ditemukan.")
        pause()
        return data
    
    bulk = bulk_inputs[bulk_idx]
    
    print_header(f"✏️ EDIT BELANJA #{bulk_id}")
    
    # Show current items
    print(f"  {Colors.BOLD}Item saat ini:{Colors.END}")
    print_separator()
    for i, item in enumerate(bulk["items"], 1):
        unit = item.get('unit', 'pcs')
        qty = item.get('quantity', 1)
        price_unit = item.get('price_per_unit', item['cost'])
        print(f"  {i}. {item['name']}")
        print(f"     {format_number(qty)} {unit} × {format_currency(price_unit)} = {format_currency(item['cost'])}")
    print_separator()
    
    print(f"\n  {Colors.BOLD}Opsi Edit:{Colors.END}")
    print_menu_item(1, "Edit item")
    print_menu_item(2, "Hapus item")
    print_menu_item(3, "Tambah item baru")
    print_menu_item(4, "Batal")
    print()
    
    edit_choice = get_menu_choice(4)
    
    if edit_choice == 1:
        item_num = get_valid_int(f"  {Colors.YELLOW}▶ Nomor item yang akan diedit:{Colors.END} ", 1, len(bulk["items"]))
        item = bulk["items"][item_num - 1]
        
        print(f"\n  {Colors.GRAY}Edit {item['name']}:{Colors.END}")
        print(f"  {Colors.GRAY}Tekan Enter untuk skip/tidak mengubah{Colors.END}\n")
        
        # Edit quantity
        new_qty_str = input(f"  Jumlah baru (saat ini: {format_number(item.get('quantity', 1))}): ").strip()
        if new_qty_str:
            item['quantity'] = float(new_qty_str.replace(".", "").replace(",", "."))
        
        # Edit price per unit
        new_price_str = input(f"  Harga per unit baru (saat ini: {format_currency(item.get('price_per_unit', item['cost']))}): ").strip()
        if new_price_str:
            item['price_per_unit'] = float(new_price_str.replace(".", "").replace(",", "."))
        
        # Recalculate item cost
        item['cost'] = item.get('quantity', 1) * item.get('price_per_unit', item['cost'])
        
        print_success("Item berhasil diupdate.")
        
    elif edit_choice == 2:
        item_num = get_valid_int(f"  {Colors.YELLOW}▶ Nomor item yang akan dihapus:{Colors.END} ", 1, len(bulk["items"]))
        removed = bulk["items"].pop(item_num - 1)
        print_success(f"Dihapus: {removed['name']}")
        
        if not bulk["items"]:
            print_warning("Tidak ada item tersisa di belanja ini.")
            if get_yes_no(f"  {Colors.YELLOW}Hapus belanja ini? (y/n):{Colors.END} "):
                bulk_inputs.pop(bulk_idx)
                print_success("Belanja dihapus.")
        
    elif edit_choice == 3:
        name = input(f"  {Colors.WHITE}Nama bahan:{Colors.END} ").strip()
        if name:
            quantity = get_valid_float(f"  {Colors.WHITE}Jumlah:{Colors.END} ", allow_zero=False)
            unit = select_unit()
            price_per_unit = get_valid_float(f"  {Colors.WHITE}Harga per {unit} (Rp):{Colors.END} ", allow_zero=False)
            
            total_cost = quantity * price_per_unit
            
            bulk["items"].append({
                "name": name,
                "quantity": quantity,
                "unit": unit,
                "price_per_unit": price_per_unit,
                "cost": total_cost
            })
            print_success("Item ditambahkan.")
    else:
        return data
    
    # Recalculate totals
    if bulk_idx is not None and bulk_idx < len(bulk_inputs):
        bulk_inputs[bulk_idx]["total"] = sum(item["cost"] for item in bulk_inputs[bulk_idx]["items"])
    day_data["day_total"] = calculate_day_total(day_data)
    
    # Clean up empty days
    if not bulk_inputs:
        del data[date_str]
    
    save_data(data)
    pause()
    return data

def delete_bulk_input(data, date_str):
    """Delete a bulk input."""
    day_data = data[date_str]
    bulk_inputs = day_data["bulk_inputs"]
    
    if len(bulk_inputs) == 1:
        bulk_id = bulk_inputs[0]["id"]
        print_info(f"Hanya ada Belanja #{bulk_id}")
    else:
        print(f"\n  {Colors.GRAY}ID Belanja yang tersedia: {', '.join(str(b['id']) for b in bulk_inputs)}{Colors.END}")
        bulk_id = get_valid_int(f"  {Colors.YELLOW}▶ Masukkan ID Belanja yang akan dihapus:{Colors.END} ", 1)
    
    # Find and remove
    for i, bulk in enumerate(bulk_inputs):
        if bulk["id"] == bulk_id:
            if get_yes_no(f"  {Colors.RED}Hapus Belanja #{bulk_id} ({format_currency(bulk['total'])})? (y/n):{Colors.END} "):
                bulk_inputs.pop(i)
                day_data["day_total"] = calculate_day_total(day_data)
                
                if not bulk_inputs:
                    del data[date_str]
                
                save_data(data)
                print_success("Belanja berhasil dihapus.")
            pause()
            return data
    
    print_error(f"Belanja #{bulk_id} tidak ditemukan.")
    pause()
    return data

# ============================================================================
# REPORTS FUNCTIONS
# ============================================================================

def _export_menu(data):
    """Choose between CSV and Excel export."""
    print_header("📤 EKSPOR DATA")
    print_menu_item(1, "Ekspor ke CSV")
    print_menu_item(2, "Ekspor ke Excel (.xlsx)")
    print_menu_item(3, "Batal")
    print()

    choice = get_menu_choice(3)
    if choice == 1:
        export_to_csv(data)
    elif choice == 2:
        export_to_excel(data)

def reports_menu(data):
    """Reports menu."""
    while True:
        print_header("📊 LAPORAN", "Lihat ringkasan dan ekspor laporan")
        
        if not data:
            print_box([
                "Belum ada data untuk laporan.",
                "Silakan tambah belanja terlebih dahulu!"
            ], "ℹ Info", color=Colors.YELLOW)
            pause()
            return
        
        print_menu_item(1, "Laporan Harian")
        print_menu_item(2, "Laporan 7 Hari Terakhir")
        print_menu_item(3, "Laporan 30 Hari Terakhir")
        print_menu_item(4, "Laporan Rentang Tanggal")
        print_menu_item(5, "Ringkasan Semua Data")
        print_menu_item(6, "Laporan per Kategori")
        print_menu_item(7, "Laporan per Supplier")
        print_menu_item(8, "Analitik per Kategori")
        print_menu_item(9, "Ekspor ke CSV/Excel")
        print_menu_item(10, "Kembali ke Menu Utama")
        print()

        choice = get_menu_choice(10)
        
        if choice == 1:
            view_day_report(data)
        elif choice == 2:
            today = datetime.now()
            generate_range_report(data, today - timedelta(days=6), today)
        elif choice == 3:
            today = datetime.now()
            generate_range_report(data, today - timedelta(days=29), today)
        elif choice == 4:
            print_range_report(data)
        elif choice == 5:
            view_all_summary(data)
        elif choice == 7:
            report_by_supplier(data)
        elif choice == 8:
            analytics_by_category(data)
        elif choice == 9:
            _export_menu(data)
        else:
            return


def view_day_report(data):
    """View detailed report for a single day."""
    print_header("📅 LAPORAN HARIAN")
    
    date_str = get_valid_date(f"  {Colors.YELLOW}📅 Masukkan tanggal (YYYY-MM-DD):{Colors.END} ")
    
    if date_str not in data:
        print_error(f"Tidak ada data untuk tanggal {date_str}")
        pause()
        return
    
    print_day_breakdown(data, date_str)
    pause()

def print_day_breakdown(data, date_str):
    """Print detailed breakdown for a day."""
    day_data = data[date_str]
    
    print(f"\n  {Colors.CYAN}╔{'═' * 62}╗{Colors.END}")
    print(f"  {Colors.CYAN}║{Colors.END} {Colors.BOLD}📅 TANGGAL: {date_str:^48}{Colors.END} {Colors.CYAN}║{Colors.END}")
    print(f"  {Colors.CYAN}╠{'═' * 62}╣{Colors.END}")
    
    for bulk in day_data["bulk_inputs"]:
        print(f"  {Colors.CYAN}║{Colors.END}")
        sup_label = supplier_label(data, bulk.get("supplier_id"))
        print(f"  {Colors.CYAN}║{Colors.END}  {Colors.BOLD}🛒 Belanja #{bulk['id']}{Colors.END}"
              f"  {Colors.GRAY}🏪 {sup_label}  •  {bulk['timestamp']}{Colors.END}")
        print(f"  {Colors.CYAN}║{Colors.END}  {'─' * 56}")
        
        for item in bulk["items"]:
            name = item["name"][:30]
            unit = item.get('unit', 'pcs')
            qty = item.get('quantity', 1)
            price_unit = item.get('price_per_unit', item['cost'])
            
            print(f"  {Colors.CYAN}║{Colors.END}    {name}")
            calc_str = f"{format_number(qty)} {unit} × {format_currency(price_unit)}"
            cost_str = format_currency(item['cost'])
            print(f"  {Colors.CYAN}║{Colors.END}    {Colors.GRAY}{calc_str:<35}{Colors.END} {Colors.GREEN}{cost_str:>15}{Colors.END}")
        
        print(f"  {Colors.CYAN}║{Colors.END}  {'─' * 56}")
        print(f"  {Colors.CYAN}║{Colors.END}    {Colors.BOLD}{'Subtotal:':<35} {format_currency(bulk['total']):>15}{Colors.END}")
    
    print(f"  {Colors.CYAN}║{Colors.END}")
    print(f"  {Colors.CYAN}╠{'═' * 62}╣{Colors.END}")
    print(f"  {Colors.CYAN}║{Colors.END}  {Colors.BOLD}{Colors.GREEN}💰 TOTAL HARI INI:{' ' * 20} {format_currency(day_data['day_total']):>15}{Colors.END} {Colors.CYAN}║{Colors.END}")
    print(f"  {Colors.CYAN}╚{'═' * 62}╝{Colors.END}")

def print_range_report(data):
    """Print report for a date range."""
    print_header("📆 LAPORAN RENTANG TANGGAL")
    
    print(f"\n  {Colors.YELLOW}Masukkan rentang tanggal:{Colors.END}")
    start_str = get_valid_date(f"  {Colors.WHITE}Tanggal mulai (YYYY-MM-DD):{Colors.END} ")
    end_str = get_valid_date(f"  {Colors.WHITE}Tanggal akhir (YYYY-MM-DD):{Colors.END} ")
    
    start_date = datetime.strptime(start_str, DATE_FORMAT)
    end_date = datetime.strptime(end_str, DATE_FORMAT)
    
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    
    generate_range_report(data, start_date, end_date)

def generate_range_report(data, start_date, end_date):
    """Generate and display a report for the given date range."""
    print_header("📊 LAPORAN PENGELUARAN BAHAN", 
                f"{start_date.strftime(DATE_FORMAT)} s/d {end_date.strftime(DATE_FORMAT)}")
    
    grand_total = 0
    days_with_data = 0
    total_items = 0
    
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime(DATE_FORMAT)
        
        if date_str in data:
            days_with_data += 1
            print_day_breakdown(data, date_str)
            grand_total += data[date_str]["day_total"]
            for bulk in data[date_str]["bulk_inputs"]:
                total_items += len(bulk["items"])
        
        current_date += timedelta(days=1)
    
    if days_with_data == 0:
        print_warning("Tidak ada data untuk rentang tanggal ini.")
    else:
        # Summary box
        print(f"\n  {Colors.GREEN}╔{'═' * 62}╗{Colors.END}")
        print(f"  {Colors.GREEN}║{Colors.END} {Colors.BOLD}📊 RINGKASAN LAPORAN{' ' * 40}{Colors.END} {Colors.GREEN}║{Colors.END}")
        print(f"  {Colors.GREEN}╠{'═' * 62}╣{Colors.END}")
        print(f"  {Colors.GREEN}║{Colors.END}   Periode      : {start_date.strftime(DATE_FORMAT)} s/d {end_date.strftime(DATE_FORMAT):<20} {Colors.GREEN}║{Colors.END}")
        print(f"  {Colors.GREEN}║{Colors.END}   Hari dengan data : {days_with_data:<38} {Colors.GREEN}║{Colors.END}")
        print(f"  {Colors.GREEN}║{Colors.END}   Total item       : {total_items:<38} {Colors.GREEN}║{Colors.END}")
        print(f"  {Colors.GREEN}╠{'═' * 62}╣{Colors.END}")
        print(f"  {Colors.GREEN}║{Colors.END}   {Colors.BOLD}💰 GRAND TOTAL : {format_currency(grand_total):>40}{Colors.END}   {Colors.GREEN}║{Colors.END}")
        print(f"  {Colors.GREEN}╚{'═' * 62}╝{Colors.END}")
    
    # Offer to save to file
    print()
    if get_yes_no(f"  {Colors.YELLOW}💾 Simpan laporan ke file teks? (y/n):{Colors.END} "):
        save_report_to_file(data, start_date, end_date, grand_total)
    
    pause()

def save_report_to_file(data, start_date, end_date, grand_total):
    """Save report to a text file."""
    filename = f"laporan_{start_date.strftime(DATE_FORMAT)}_sd_{end_date.strftime(DATE_FORMAT)}.txt"
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 65 + "\n")
            f.write("        LAPORAN PENGELUARAN BAHAN CATERING\n")
            f.write("=" * 65 + "\n")
            f.write(f"Periode    : {start_date.strftime(DATE_FORMAT)} s/d {end_date.strftime(DATE_FORMAT)}\n")
            f.write(f"Dibuat     : {datetime.now().strftime(DATETIME_FORMAT)}\n")
            f.write("=" * 65 + "\n\n")
            
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime(DATE_FORMAT)
                
                if date_str in data:
                    day_data = data[date_str]
                    f.write(f"\n{'─' * 65}\n")
                    f.write(f"TANGGAL: {date_str}\n")
                    f.write(f"{'─' * 65}\n")
                    
                    for bulk in day_data["bulk_inputs"]:
                        f.write(f"\n  Belanja #{bulk['id']} ({bulk['timestamp']})\n")
                        f.write("  " + "-" * 55 + "\n")
                        
                        for item in bulk["items"]:
                            unit = item.get('unit', 'pcs')
                            qty = item.get('quantity', 1)
                            price_unit = item.get('price_per_unit', item['cost'])
                            
                            f.write(f"    • {item['name']}\n")
                            f.write(f"      {format_number(qty)} {unit} × {format_currency(price_unit)}/{unit}\n")
                            f.write(f"      = {format_currency(item['cost'])}\n")
                        
                        f.write("  " + "-" * 55 + "\n")
                        f.write(f"  Subtotal: {format_currency(bulk['total'])}\n")
                    
                    f.write(f"\n  ** Total Hari: {format_currency(day_data['day_total'])} **\n")
                
                current_date += timedelta(days=1)
            
            f.write("\n" + "=" * 65 + "\n")
            f.write(f"GRAND TOTAL: {format_currency(grand_total)}\n")
            f.write("=" * 65 + "\n")
        
        print_success(f"Laporan disimpan: {filename}")
    except IOError as e:
        print_error(f"Gagal menyimpan file: {e}")

def view_all_summary(data):
    """View summary of all data."""
    print_header("📈 RINGKASAN SEMUA DATA")
    
    sorted_dates = sorted(get_date_keys(data))
    
    print(f"  {Colors.BOLD}{'Tanggal':<15} {'Belanja':<10} {'Total':>25}{Colors.END}")
    print_separator()
    
    grand_total = 0
    total_bulks = 0
    total_items = 0
    
    for date_str in sorted_dates:
        day_data = data[date_str]
        bulk_count = len(day_data["bulk_inputs"])
        day_total = day_data["day_total"]
        grand_total += day_total
        total_bulks += bulk_count
        
        for bulk in day_data["bulk_inputs"]:
            total_items += len(bulk["items"])
        
        # Highlight today
        if date_str == datetime.now().strftime(DATE_FORMAT):
            print(f"  {Colors.GREEN}{date_str:<15} {bulk_count:<10} {format_currency(day_total):>25} ← Hari ini{Colors.END}")
        else:
            print(f"  {date_str:<15} {bulk_count:<10} {format_currency(day_total):>25}")
    
    print_separator("═")
    print(f"  {Colors.BOLD}{'TOTAL':<25} {format_currency(grand_total):>25}{Colors.END}")
    print_separator("═")
    
    # Statistics box
    print(f"\n  {Colors.CYAN}┌{'─' * 45}┐{Colors.END}")
    print(f"  {Colors.CYAN}│{Colors.END} {Colors.BOLD}📊 Statistik{Colors.END}")
    print(f"  {Colors.CYAN}├{'─' * 45}┤{Colors.END}")
    print(f"  {Colors.CYAN}│{Colors.END}   Total hari dengan data : {len(sorted_dates):<15} {Colors.CYAN}│{Colors.END}")
    print(f"  {Colors.CYAN}│{Colors.END}   Total belanja          : {total_bulks:<15} {Colors.CYAN}│{Colors.END}")
    print(f"  {Colors.CYAN}│{Colors.END}   Total item             : {total_items:<15} {Colors.CYAN}│{Colors.END}")
    if len(sorted_dates) > 0:
        avg_daily = grand_total / len(sorted_dates)
        print(f"  {Colors.CYAN}│{Colors.END}   Rata-rata per hari     : {format_currency(avg_daily):<15} {Colors.CYAN}│{Colors.END}")
    print(f"  {Colors.CYAN}└{'─' * 45}┘{Colors.END}")
    
    pause()

def report_by_category(data):
    """Show spending breakdown grouped by category."""
    print_header("🏷️  LAPORAN PER KATEGORI", "Ringkasan pengeluaran berdasarkan jenis bahan")

    if not data:
        print_warning("Belum ada data.")
        pause()
        return

    # Optional date filter
    print(f"  {Colors.GRAY}Kosongkan untuk semua data{Colors.END}")
    start_str = input(f"  {Colors.WHITE}Dari tanggal (YYYY-MM-DD / Enter = semua):{Colors.END} ").strip()
    end_str   = input(f"  {Colors.WHITE}Sampai tanggal (YYYY-MM-DD / Enter = semua):{Colors.END} ").strip()

    # Build category totals
    cat_totals: dict = {k: {"total": 0, "count": 0} for k, _, _ in ITEM_CATEGORIES}

    for date_str in sorted(get_date_keys(data)):
        # Apply date filter if provided
        if start_str:
            try:
                if date_str < datetime.strptime(start_str, DATE_FORMAT).strftime(DATE_FORMAT):
                    continue
            except ValueError:
                pass
        if end_str:
            try:
                if date_str > datetime.strptime(end_str, DATE_FORMAT).strftime(DATE_FORMAT):
                    continue
            except ValueError:
                pass

        for bulk in data[date_str].get("bulk_inputs", []):
            for item in bulk.get("items", []):
                cat = item.get("category", "lainnya")
                if cat not in cat_totals:
                    cat_totals[cat] = {"total": 0, "count": 0}
                cat_totals[cat]["total"] += item.get("cost", 0)
                cat_totals[cat]["count"] += 1

    grand_total = sum(v["total"] for v in cat_totals.values())

    if grand_total == 0:
        print_warning("Tidak ada data pada rentang ini.")
        pause()
        return

    print_header("🏷️  BREAKDOWN PER KATEGORI")

    # Sort by total descending
    sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1]["total"], reverse=True)

    print(f"  {Colors.BOLD}{'Kategori':<30} {'Jumlah Item':>12} {'Total':>18} {'%':>7}{Colors.END}")
    print_separator("─", 65)

    for key, vals in sorted_cats:
        if vals["total"] == 0:
            continue
        label = category_label(key)
        pct   = vals["total"] / grand_total * 100

        # Simple bar proportional to percentage
        bar_len = int(pct / 5)          # max 20 chars at 100%
        bar     = f"{Colors.CYAN}{'█' * bar_len}{Colors.END}"

        print(
            f"  {label:<30}"
            f"{vals['count']:>12}"
            f"{format_currency(vals['total']):>18}"
            f"{pct:>6.1f}%"
        )
        print(f"  {Colors.GRAY}  {bar}{Colors.END}")

    print_separator("═", 65)
    print(f"  {Colors.BOLD}{'TOTAL':<42} {format_currency(grand_total):>18}{Colors.END}")

    pause()

def analytics_by_category(data):
    """Deep analytics: monthly trend, top items, and category drill-down."""
    while True:
        print_header("📊 ANALITIK PER KATEGORI", "Tren bulanan & detail pengeluaran")

        if not get_date_keys(data):
            print_warning("Belum ada data.")
            pause()
            return

        print_menu_item(1, "Tren Bulanan per Kategori")
        print_menu_item(2, "Top Item per Kategori")
        print_menu_item(3, "Drill-down Satu Kategori")
        print_menu_item(4, "Kembali")
        print()

        choice = get_menu_choice(4)

        if choice == 1:
            _analytics_monthly_trend(data)
        elif choice == 2:
            _analytics_top_items(data)
        elif choice == 3:
            _analytics_drilldown(data)
        else:
            return


def _collect_category_data(data, start_str="", end_str=""):
    """
    Returns:
      monthly   → { "YYYY-MM": { cat_key: total } }
      cat_items → { cat_key: [ {name, qty, unit, price, cost, date} ] }
      cat_totals→ { cat_key: {"total": 0, "count": 0} }
    """
    monthly    = {}
    cat_items  = {k: [] for k, _, _ in ITEM_CATEGORIES}
    cat_totals = {k: {"total": 0, "count": 0} for k, _, _ in ITEM_CATEGORIES}

    for date_str in sorted(get_date_keys(data)):
        if start_str and date_str < start_str:
            continue
        if end_str and date_str > end_str:
            continue

        month = date_str[:7]   # "YYYY-MM"
        if month not in monthly:
            monthly[month] = {k: 0 for k, _, _ in ITEM_CATEGORIES}

        for bulk in data[date_str].get("bulk_inputs", []):
            for item in bulk.get("items", []):
                cat = item.get("category", "lainnya")

                # Ensure keys exist for unknown categories
                if cat not in cat_totals:
                    cat_totals[cat] = {"total": 0, "count": 0}
                if cat not in monthly[month]:
                    monthly[month][cat] = 0
                if cat not in cat_items:
                    cat_items[cat] = []

                cost = item.get("cost", 0)
                cat_totals[cat]["total"] += cost
                cat_totals[cat]["count"] += 1
                monthly[month][cat]      += cost
                cat_items[cat].append({
                    "date":           date_str,
                    "name":           item.get("name", ""),
                    "quantity":       item.get("quantity", 1),
                    "unit":           item.get("unit", "pcs"),
                    "price_per_unit": item.get("price_per_unit", cost),
                    "cost":           cost,
                })

    return monthly, cat_items, cat_totals


def _analytics_monthly_trend(data):
    """Print a month × category spending table."""
    print_header("📅 TREN BULANAN PER KATEGORI")

    monthly, _, cat_totals = _collect_category_data(data)

    if not monthly:
        print_warning("Tidak ada data.")
        pause()
        return

    # Only show categories that have at least some spending
    active_cats = [
        (k, label, icon)
        for k, label, icon in ITEM_CATEGORIES
        if cat_totals.get(k, {}).get("total", 0) > 0
    ]

    if not active_cats:
        print_warning("Tidak ada kategori dengan data.")
        pause()
        return

    months = sorted(monthly.keys())

    # ── Header row ────────────────────────────────────────────────
    cat_col = 22
    mon_col = 16

    header = f"  {Colors.BOLD}{'Kategori':<{cat_col}}"
    for m in months:
        header += f"{m:>{mon_col}}"
    header += f"{'TOTAL':>{mon_col}}{Colors.END}"
    print(header)
    print_separator("─", cat_col + mon_col * (len(months) + 1) + 2)

    # ── Data rows ─────────────────────────────────────────────────
    month_totals = {m: 0 for m in months}
    grand_total  = 0

    for k, label, icon in active_cats:
        row_total = sum(monthly[m].get(k, 0) for m in months)
        grand_total += row_total

        row = f"  {icon} {label:<{cat_col - 3}}"
        for m in months:
            val = monthly[m].get(k, 0)
            month_totals[m] += val
            val_str = format_currency(val).replace("Rp ", "") if val else "—"
            row += f"{val_str:>{mon_col}}"

        total_str = format_currency(row_total).replace("Rp ", "")
        row += f"{Colors.BOLD}{total_str:>{mon_col}}{Colors.END}"
        print(row)

    # ── Footer totals ─────────────────────────────────────────────
    print_separator("═", cat_col + mon_col * (len(months) + 1) + 2)
    footer = f"  {Colors.BOLD}{'TOTAL':<{cat_col}}"
    for m in months:
        t_str = format_currency(month_totals[m]).replace("Rp ", "")
        footer += f"{t_str:>{mon_col}}"
    gt_str = format_currency(grand_total).replace("Rp ", "")
    footer += f"{gt_str:>{mon_col}}{Colors.END}"
    print(footer)

    # ── Month-over-month change ───────────────────────────────────
    if len(months) >= 2:
        print(f"\n  {Colors.CYAN}📈 Perubahan Bulan ke Bulan:{Colors.END}")
        print_separator("─", 50)
        for i in range(1, len(months)):
            prev = month_totals[months[i - 1]]
            curr = month_totals[months[i]]
            if prev > 0:
                pct  = (curr - prev) / prev * 100
                icon = f"{Colors.RED}▲" if pct > 0 else f"{Colors.GREEN}▼"
                print(f"  {months[i-1]} → {months[i]} : "
                      f"{icon} {abs(pct):.1f}%{Colors.END}  "
                      f"({format_currency(prev)} → {format_currency(curr)})")

    pause()


def _analytics_top_items(data, top_n=5):
    """Show top N most expensive items per active category."""
    print_header(f"🏆 TOP {top_n} ITEM PER KATEGORI")

    _, cat_items, cat_totals = _collect_category_data(data)

    active_cats = [
        (k, label, icon)
        for k, label, icon in ITEM_CATEGORIES
        if cat_totals.get(k, {}).get("total", 0) > 0
    ]

    if not active_cats:
        print_warning("Tidak ada data.")
        pause()
        return

    for k, label, icon in active_cats:
        items = cat_items.get(k, [])
        if not items:
            continue

        # Aggregate by name (combine same item across dates)
        aggregated = {}
        for entry in items:
            name = entry["name"].lower().strip()
            if name not in aggregated:
                aggregated[name] = {
                    "name":  entry["name"],
                    "total": 0,
                    "count": 0,
                    "unit":  entry["unit"],
                    "qty":   0,
                }
            aggregated[name]["total"] += entry["cost"]
            aggregated[name]["count"] += 1
            aggregated[name]["qty"]   += entry["quantity"]

        top = sorted(aggregated.values(), key=lambda x: x["total"], reverse=True)[:top_n]
        cat_total = cat_totals[k]["total"]

        print(f"\n  {Colors.CYAN}{'─' * 60}{Colors.END}")
        print(f"  {icon} {Colors.BOLD}{label}{Colors.END}"
              f"  {Colors.GRAY}Total: {format_currency(cat_total)}{Colors.END}")
        print(f"  {Colors.CYAN}{'─' * 60}{Colors.END}")

        for rank, item in enumerate(top, 1):
            pct     = item["total"] / cat_total * 100 if cat_total else 0
            bar_len = int(pct / 5)
            bar     = f"{Colors.YELLOW}{'█' * bar_len}{Colors.END}"
            print(f"  {Colors.BOLD}{rank}.{Colors.END} {item['name']:<28} "
                  f"{format_currency(item['total']):>14}  {pct:>5.1f}%")
            print(f"     {Colors.GRAY}{format_number(item['qty'])} {item['unit']} "
                  f"× {item['count']} pembelian   {bar}{Colors.END}")

    pause()


def _analytics_drilldown(data):
    """Show all purchases within a single chosen category."""
    print_header("🔎 DRILL-DOWN KATEGORI")

    # Show category picker
    print(f"  {Colors.BOLD}Pilih kategori:{Colors.END}\n")
    for i, (k, label, icon) in enumerate(ITEM_CATEGORIES, 1):
        print(f"  {Colors.CYAN}[{i:2}]{Colors.END} {icon} {label}")
    print()

    choice = get_menu_choice(len(ITEM_CATEGORIES))
    cat_key, cat_label, cat_icon = ITEM_CATEGORIES[choice - 1]

    # Optional date range
    print(f"  {Colors.GRAY}Kosongkan untuk semua data{Colors.END}")
    start_str = input(f"  {Colors.WHITE}Dari tanggal (YYYY-MM-DD / Enter = semua):{Colors.END} ").strip()
    end_str   = input(f"  {Colors.WHITE}Sampai tanggal (YYYY-MM-DD / Enter = semua):{Colors.END} ").strip()

    _, cat_items, cat_totals = _collect_category_data(data, start_str, end_str)

    items = cat_items.get(cat_key, [])

    if not items:
        print_warning(f"Tidak ada data untuk kategori {cat_label}.")
        pause()
        return

    print_header(f"{cat_icon} {cat_label}", f"{len(items)} transaksi ditemukan")

    print(f"  {Colors.BOLD}"
          f"{'Tanggal':<13}"
          f"{'Nama Bahan':<26}"
          f"{'Qty':<13}"
          f"{'Harga/unit':<16}"
          f"{'Total':>12}"
          f"{Colors.END}")
    print_separator("─", 65)

    for entry in items:
        name_short = entry["name"][:24] + ".." if len(entry["name"]) > 26 else entry["name"]
        qty_str    = f"{format_number(entry['quantity'])} {entry['unit']}"
        print(
            f"  {entry['date']:<13}"
            f"{name_short:<26}"
            f"{qty_str:<13}"
            f"{format_currency(entry['price_per_unit']):<16}"
            f"{format_currency(entry['cost']):>12}"
        )

    print_separator("═", 65)
    total = cat_totals.get(cat_key, {}).get("total", 0)
    print(f"  {Colors.BOLD}Total {cat_label:<30} {format_currency(total):>12}{Colors.END}")

    pause()

def report_by_supplier(data):
    """Show spending breakdown grouped by supplier."""
    print_header("🏪 LAPORAN PER SUPPLIER", "Total belanja per pemasok")

    suppliers = get_suppliers(data)
    totals    = {}   # supplier_id (str) → {"name": ..., "total": ..., "trips": ...}

    for date_str, day_data in data.items():
        if date_str == "suppliers":
            continue
        for bulk in day_data.get("bulk_inputs", []):
            sid   = str(bulk.get("supplier_id", "none"))
            name  = supplier_label(data, bulk.get("supplier_id")) if sid != "none" else "— Tidak diketahui"
            if sid not in totals:
                totals[sid] = {"name": name, "total": 0, "trips": 0, "items": 0}
            totals[sid]["total"]  += bulk.get("total", 0)
            totals[sid]["trips"]  += 1
            totals[sid]["items"]  += len(bulk.get("items", []))

    if not totals:
        print_warning("Tidak ada data.")
        pause()
        return

    grand_total = sum(v["total"] for v in totals.values())
    sorted_totals = sorted(totals.items(), key=lambda x: x[1]["total"], reverse=True)

    print(f"\n  {Colors.BOLD}{'Supplier':<28}{'Kunjungan':>10}{'Item':>8}{'Total':>18}{'%':>7}{Colors.END}")
    print_separator("─", 65)

    for sid, v in sorted_totals:
        pct     = v["total"] / grand_total * 100 if grand_total else 0
        bar_len = int(pct / 5)
        bar     = f"{Colors.CYAN}{'█' * bar_len}{Colors.END}"
        print(
            f"  {v['name']:<28}"
            f"{v['trips']:>10}"
            f"{v['items']:>8}"
            f"{format_currency(v['total']):>18}"
            f"{pct:>6.1f}%"
        )
        print(f"  {Colors.GRAY}  {bar}{Colors.END}")

    print_separator("═", 65)
    print(f"  {Colors.BOLD}{'TOTAL':<46}{format_currency(grand_total):>18}{Colors.END}")

    pause()

def export_to_csv(data):
    """Export all data to a CSV file.

    Notes:
    - This function must live at module scope (not indented inside another function).
    - If you prefer an Excel .xlsx export later, we can add a pandas-based exporter.
    """
    print_header("📊 EKSPOR KE CSV", "Export data ke file spreadsheet")

    if not data:
        print_error("Tidak ada data untuk diekspor.")
        pause()
        return

    filename = f"catering_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    try:
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f, delimiter=';')


            # Header row
            writer.writerow([
                'Tanggal', 'Belanja ID', 'Waktu Input',
                'Nama Bahan', 'Jumlah', 'Satuan',
                'Harga per Unit', 'Total Biaya', 'Total Harian'
            ])

            # Write data rows. For each date we only include the daily total on the
            # first row for that date (so it doesn't repeat on every item).
            for date_str in sorted(get_date_keys(data)):
                day_data = data[date_str]
                day_total = day_data.get('day_total', 0)
                day_total_written = False

                for bulk in day_data.get('bulk_inputs', []):
                    bulk_id = bulk.get('id', '')
                    timestamp = bulk.get('timestamp', '')

                    for item in bulk.get('items', []):
                        writer.writerow([
                            date_str,
                            bulk_id,
                            timestamp,
                            item.get('name', ''),
                            item.get('quantity', ''),
                            item.get('unit', ''),
                            item.get('price_per_unit', ''),
                            item.get('cost', ''),
                            day_total if not day_total_written else ''
                        ])

                        # After we write the first row for the day, don't repeat the day total
                        day_total_written = True

        print_success(f"✓ Data berhasil diekspor ke: {filename}")
        print_info("  File dapat dibuka dengan Excel, Google Sheets, atau LibreOffice")

    except IOError as e:
        print_error(f"Gagal membuat file CSV: {e}")

    pause()

    # ============================================================================

def export_to_excel(data):
    """Export all data to a formatted .xlsx file with multiple sheets."""
    if not _EXCEL_ENABLED:
        print_error("openpyxl tidak terinstall.")
        print_info("Jalankan: pip install openpyxl")
        pause()
        return

    print_header("📗 EKSPOR KE EXCEL", "Membuat file .xlsx terformat")

    filename = f"catering_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    wb       = openpyxl.Workbook()

    # ── Styles ────────────────────────────────────────────────────
    header_font    = Font(bold=True, color="FFFFFF")
    header_fill    = PatternFill("solid", fgColor="1F6AA5")
    subhead_fill   = PatternFill("solid", fgColor="2E86AB")
    alt_fill       = PatternFill("solid", fgColor="EAF4FB")
    total_font     = Font(bold=True)
    total_fill     = PatternFill("solid", fgColor="D5E8D4")
    center_align   = Alignment(horizontal="center", vertical="center")
    right_align    = Alignment(horizontal="right")
    thin_border    = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    def style_header(cell):
        cell.font      = header_font
        cell.fill      = header_fill
        cell.alignment = center_align
        cell.border    = thin_border

    def style_total(cell):
        cell.font   = total_font
        cell.fill   = total_fill
        cell.border = thin_border

    # ── Sheet 1: All Transactions ─────────────────────────────────
    ws1 = wb.active
    ws1.title = "Semua Transaksi"

    headers = ["Tanggal", "Belanja ID", "Supplier", "Waktu Input",
               "Nama Bahan", "Kategori", "Jumlah", "Satuan",
               "Harga/Unit (Rp)", "Total (Rp)", "Total Harian (Rp)"]

    for col, h in enumerate(headers, 1):
        cell = ws1.cell(row=1, column=col, value=h)
        style_header(cell)

    row_num  = 2
    alt      = False

    for date_str in sorted(get_date_keys(data)):
        day_data    = data[date_str]
        day_total   = day_data.get("day_total", 0)
        first_row   = True

        for bulk in day_data.get("bulk_inputs", []):
            sup = supplier_label(data, bulk.get("supplier_id"))

            for item in bulk.get("items", []):
                fill = alt_fill if alt else None
                vals = [
                    date_str,
                    bulk.get("id", ""),
                    sup,
                    bulk.get("timestamp", ""),
                    item.get("name", ""),
                    category_label(item.get("category", "lainnya")),
                    item.get("quantity", ""),
                    item.get("unit", ""),
                    item.get("price_per_unit", ""),
                    item.get("cost", ""),
                    day_total if first_row else "",
                ]
                for col, val in enumerate(vals, 1):
                    cell        = ws1.cell(row=row_num, column=col, value=val)
                    cell.border = thin_border
                    if fill:
                        cell.fill = fill
                    if col in (9, 10, 11):
                        cell.alignment = right_align

                row_num += 1
                first_row = False
        alt = not alt

    # Auto column width
    for col in ws1.columns:
        max_len = max((len(str(c.value)) for c in col if c.value), default=8)
        ws1.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 40)

    # ── Sheet 2: Monthly Summary ───────────────────────────────────
    ws2 = wb.create_sheet("Ringkasan Bulanan")

    monthly, _, _ = _collect_category_data(data)
    active_cats   = [(k, label, icon) for k, label, icon in ITEM_CATEGORIES]
    months        = sorted(monthly.keys())

    # Header
    ws2.cell(row=1, column=1, value="Kategori")
    style_header(ws2.cell(row=1, column=1))

    for col, m in enumerate(months, 2):
        cell = ws2.cell(row=1, column=col, value=m)
        style_header(cell)

    total_col = len(months) + 2
    cell = ws2.cell(row=1, column=total_col, value="TOTAL")
    style_header(cell)

    for r, (k, label, icon) in enumerate(active_cats, 2):
        ws2.cell(row=r, column=1, value=f"{icon} {label}").border = thin_border
        row_total = 0
        for col, m in enumerate(months, 2):
            val = monthly.get(m, {}).get(k, 0)
            cell        = ws2.cell(row=r, column=col, value=val if val else "")
            cell.border = thin_border
            if val:
                cell.alignment = right_align
            row_total += val
        total_cell           = ws2.cell(row=r, column=total_col, value=row_total if row_total else "")
        total_cell.font      = total_font
        total_cell.border    = thin_border
        total_cell.alignment = right_align

    # Footer totals row
    total_row = len(active_cats) + 2
    ws2.cell(row=total_row, column=1, value="TOTAL")
    style_total(ws2.cell(row=total_row, column=1))

    for col, m in enumerate(months, 2):
        col_total = sum(monthly.get(m, {}).get(k, 0) for k, _, _ in active_cats)
        cell = ws2.cell(row=total_row, column=col, value=col_total)
        style_total(cell)
        cell.alignment = right_align

    for col in ws2.columns:
        max_len = max((len(str(c.value)) for c in col if c.value), default=8)
        ws2.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 25)

    # ── Sheet 3: Per Supplier ──────────────────────────────────────
    ws3 = wb.create_sheet("Per Supplier")

    sup_headers = ["Supplier", "Total Kunjungan", "Total Item", "Total (Rp)", "%"]
    for col, h in enumerate(sup_headers, 1):
        style_header(ws3.cell(row=1, column=col, value=h))

    totals      = {}
    grand_total = 0

    for date_str, day_data in data.items():
        if date_str == "suppliers":
            continue
        for bulk in day_data.get("bulk_inputs", []):
            sid  = str(bulk.get("supplier_id", "none"))
            name = supplier_label(data, bulk.get("supplier_id")) if sid != "none" else "— Tidak diketahui"
            if sid not in totals:
                totals[sid] = {"name": name, "total": 0, "trips": 0, "items": 0}
            totals[sid]["total"] += bulk.get("total", 0)
            totals[sid]["trips"] += 1
            totals[sid]["items"] += len(bulk.get("items", []))
            grand_total          += bulk.get("total", 0)

    for r, (sid, v) in enumerate(
        sorted(totals.items(), key=lambda x: x[1]["total"], reverse=True), 2
    ):
        pct  = v["total"] / grand_total * 100 if grand_total else 0
        vals = [v["name"], v["trips"], v["items"], v["total"], round(pct, 1)]
        for col, val in enumerate(vals, 1):
            cell        = ws3.cell(row=r, column=col, value=val)
            cell.border = thin_border
            if col in (2, 3, 4, 5):
                cell.alignment = right_align

    for col in ws3.columns:
        max_len = max((len(str(c.value)) for c in col if c.value), default=8)
        ws3.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 30)

    # ── Save ──────────────────────────────────────────────────────
    try:
        wb.save(filename)
        print_success(f"File Excel disimpan: {filename}")
        print_info("Berisi 3 sheet: Semua Transaksi, Ringkasan Bulanan, Per Supplier")
    except IOError as e:
        print_error(f"Gagal menyimpan: {e}")

    pause()

# SEARCH & PRICE HISTORY
# ============================================================================

def search_items(data):
    """Search for an ingredient across all dates and show price history."""
    print_header("🔍 CARI BAHAN", "Lacak harga dan riwayat pembelian")

    if not data:
        print_box(["Belum ada data.", "Tambah belanja terlebih dahulu!"],
                  "ℹ Info", color=Colors.YELLOW)
        pause()
        return

    query = input(f"  {Colors.YELLOW}🔍 Nama bahan yang dicari:{Colors.END} ").strip().lower()

    if not query:
        print_error("Query tidak boleh kosong.")
        pause()
        return

    results = []

    for date_str in sorted(get_date_keys(data)):
        for bulk in data[date_str].get("bulk_inputs", []):
            for item in bulk.get("items", []):
                if query in item["name"].lower():
                    results.append({
                        "date":           date_str,
                        "bulk_id":        bulk["id"],
                        "name":           item["name"],
                        "quantity":       item.get("quantity", 1),
                        "unit":           item.get("unit", "pcs"),
                        "price_per_unit": item.get("price_per_unit", item["cost"]),
                        "cost":           item["cost"],
                        "category":       item.get("category", "—"),
                    })

    if not results:
        print_warning(f"Tidak ada hasil untuk '{query}'.")
        pause()
        return

    print_header(f"🔍 HASIL: '{query}'", f"{len(results)} entri ditemukan")

    # ── Table ──────────────────────────────────────────────────────────────
    print(f"  {Colors.BOLD}"
          f"{'Tanggal':<13}"
          f"{'Nama Bahan':<24}"
          f"{'Qty':<13}"
          f"{'Harga/unit':<16}"
          f"{'Total':>14}"
          f"{Colors.END}")
    print_separator("─", 65)

    total_spent  = 0
    total_qty_by_unit: dict = {}   # unit → total qty (for same-unit items)

    for r in results:
        name_short = r["name"][:22] + ".." if len(r["name"]) > 24 else r["name"]
        qty_str    = f"{format_number(r['quantity'])} {r['unit']}"
        print(
            f"  {r['date']:<13}"
            f"{name_short:<24}"
            f"{qty_str:<13}"
            f"{format_currency(r['price_per_unit']):<16}"
            f"{format_currency(r['cost']):>14}"
        )
        total_spent += r["cost"]
        unit = r["unit"]
        total_qty_by_unit[unit] = total_qty_by_unit.get(unit, 0) + r["quantity"]

    print_separator("═", 65)
    print(f"  {Colors.BOLD}Total pengeluaran  : {format_currency(total_spent)}{Colors.END}")

    # Qty summary per unit
    for unit, qty in total_qty_by_unit.items():
        print(f"  {Colors.GRAY}Total dibeli       : {format_number(qty)} {unit}{Colors.END}")

    # ── Price trend (only meaningful when ≥ 2 purchases) ──────────────────
    if len(results) >= 2:
        prices = [r["price_per_unit"] for r in results]
        dates  = [r["date"]           for r in results]
        first_price = prices[0]
        last_price  = prices[-1]
        drift_pct   = ((last_price - first_price) / first_price * 100) if first_price else 0

        if drift_pct > 0:
            trend_icon  = f"{Colors.RED}▲ naik{Colors.END}"
        elif drift_pct < 0:
            trend_icon  = f"{Colors.GREEN}▼ turun{Colors.END}"
        else:
            trend_icon  = f"{Colors.GRAY}= stabil{Colors.END}"

        print(f"\n  {Colors.CYAN}┌{'─' * 52}┐{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}  {Colors.BOLD}📈 Analisis Harga per Unit{Colors.END}")
        print(f"  {Colors.CYAN}├{'─' * 52}┤{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}   Harga terendah   : {format_currency(min(prices)):<25} {Colors.CYAN}│{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}   Harga tertinggi  : {format_currency(max(prices)):<25} {Colors.CYAN}│{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}   Rata-rata        : {format_currency(sum(prices)/len(prices)):<25} {Colors.CYAN}│{Colors.END}")
        print(f"  {Colors.CYAN}├{'─' * 52}┤{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}   Harga pertama ({dates[0]}) : {format_currency(first_price):<12} {Colors.CYAN}│{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}   Harga terakhir  ({dates[-1]}) : {format_currency(last_price):<12} {Colors.CYAN}│{Colors.END}")
        print(f"  {Colors.CYAN}│{Colors.END}   Perubahan harga  : {drift_pct:+.1f}%  {trend_icon:<30} {Colors.CYAN}│{Colors.END}")
        print(f"  {Colors.CYAN}└{'─' * 52}┘{Colors.END}")

        # ASCII spark line (price over time)
        _print_sparkline(prices, "Grafik harga")

    pause()


def _print_sparkline(values: list, label: str = ""):
    """Print a simple ASCII spark line for a list of values."""
    if len(values) < 2:
        return

    bars   = "▁▂▃▄▅▆▇█"
    vmin   = min(values)
    vmax   = max(values)
    vrange = vmax - vmin if vmax != vmin else 1

    line = "".join(
        bars[int((v - vmin) / vrange * (len(bars) - 1))]
        for v in values
    )

    print(f"\n  {Colors.GRAY}{label}:{Colors.END}")
    print(f"  {Colors.CYAN}{line}{Colors.END}  "
          f"{Colors.GRAY}({format_currency(vmin)} – {format_currency(vmax)}){Colors.END}")


# ============================================================================
# MAIN MENU
# ============================================================================

def show_welcome_screen():
    """Show welcome screen on first launch."""
    clear_screen()
    print(f"""
  {Colors.CYAN}╔═══════════════════════════════════════════════════════════════╗{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   {Colors.BOLD}🍳 CATERING INGREDIENT COST TRACKER 🍳{Colors.END}                    {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   {Colors.GRAY}Pelacak Biaya Bahan Catering{Colors.END}                            {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}╠═══════════════════════════════════════════════════════════════╣{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   Fitur:                                                      {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   ✓ Catat belanja bahan dengan kalkulasi otomatis             {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   ✓ Hitung total otomatis (qty × harga per unit)              {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   ✓ Lihat dan edit data belanja                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   ✓ Buat laporan harian/mingguan/bulanan                      {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   ✓ Ekspor laporan ke file teks                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}╚═══════════════════════════════════════════════════════════════╝{Colors.END}
    """)
    input(f"  {Colors.YELLOW}Tekan Enter untuk memulai...{Colors.END}")

def main_menu():
    """Main application menu."""
    show_welcome_screen()
    data = load_data()
    if _VOICE_ENABLED: 
        _vi.start_wake_word()
    
    while True:
        print_header("CATERING COST TRACKER", "Pelacak Biaya Bahan Catering")
        
        # Show quick stats
        if data:
            today       = datetime.now().strftime(DATE_FORMAT)   # ← moved up
            date_keys   = get_date_keys(data)
            total_days  = len(date_keys)
            total_bulks = sum(len(data[d]["bulk_inputs"]) for d in date_keys)
            grand_total = sum(data[d]["day_total"] for d in date_keys)
            today_total = data[today]["day_total"] if today in date_keys else 0
                        
            # Today's stats
            today = datetime.now().strftime(DATE_FORMAT)
            today_total = data[today]["day_total"] if today in data else 0
            
            print(f"  {Colors.CYAN}┌{'─' * 58}┐{Colors.END}")
            print(f"  {Colors.CYAN}│{Colors.END} {Colors.BOLD}📊 Statistik Cepat{Colors.END}")
            print(f"  {Colors.CYAN}├{'─' * 58}┤{Colors.END}")
            print(f"  {Colors.CYAN}│{Colors.END}   Total hari  : {total_days:<10}  Hari ini : {format_currency(today_total):<15} {Colors.CYAN}│{Colors.END}")
            print(f"  {Colors.CYAN}│{Colors.END}   Total belanja: {total_bulks:<10}  Grand Total: {format_currency(grand_total):<12} {Colors.CYAN}│{Colors.END}")
            print(f"  {Colors.CYAN}└{'─' * 58}┘{Colors.END}")
        else:
            print_box([
                "Selamat datang! Belum ada data.",
                "Mulai dengan menambahkan belanja baru."
            ], "Halo!", color=Colors.YELLOW)
        
        print(f"\n  {Colors.BOLD}MENU UTAMA{Colors.END}")
        print_separator()
        print_menu_item(1, "Tambah Belanja Baru", "input lengkap")
        print_menu_item(2, "Tambah Cepat", "1 item ke hari ini")
        print_menu_item(3, "Lihat / Edit Data")
        print_menu_item(4, "Laporan")
        print_menu_item(5, "Cari Bahan")
        print_menu_item(6, "Kelola Supplier")
        print_menu_item(7, "Backup & Restore")
        print_menu_item(8, "Keluar")
        print()

        choice = get_menu_choice(8) 
        
        if choice == 1:
            data = add_bulk_input(data)
        elif choice == 2:
            data = quick_add_item(data)
        elif choice == 3:
            data = view_edit_menu(data)
        elif choice == 4:
            reports_menu(data)
        elif choice == 5:
            search_items(data)
        elif choice == 6:
            data = manage_suppliers(data)
        elif choice == 7:
            data = manage_backups(data)
        elif choice == 8:
            if _VOICE_ENABLED:  
                _vi.stop_wake_word()
            clear_screen()
            print(f"""
  {Colors.CYAN}╔═══════════════════════════════════════════════════════════════╗{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   {Colors.BOLD}Terima kasih telah menggunakan{Colors.END}                           {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   {Colors.BOLD}Catering Cost Tracker!{Colors.END}                                   {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                                                     {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}   {Colors.GREEN}✓ Data Anda telah tersimpan{Colors.END}                             {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}║{Colors.END}                                                               {Colors.CYAN}║{Colors.END}
  {Colors.CYAN}╚═══════════════════════════════════════════════════════════════╝{Colors.END}
            """)
            break

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    try:
        main_menu()
    except KeyboardInterrupt:
        print(f"\n\n  {Colors.YELLOW}Program dihentikan. Sampai jumpa!{Colors.END}\n")
    except Exception as e:
        print(f"\n  {Colors.RED}Terjadi kesalahan: {e}{Colors.END}")
        input("  Tekan Enter untuk keluar...")