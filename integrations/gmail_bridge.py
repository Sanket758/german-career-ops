#!/usr/bin/env python3
"""Gmail ↔ Career-Ops Germany Bridge.

Wraps the upstream gmail_sync.py to also update:
  - career-ops-germany/data/burn-list.tsv  (on rejection)
  - career-ops-germany/data/applications.md (tracker)

This script does NOT duplicate gmail_sync.py logic. It:
  1. Runs the upstream sync (updates the parent tracker)
  2. Post-processes the parent's CSV exports
  3. Mirrors status changes into career-ops-germany data files
  4. Auto-adds rejected companies to the burn list with 6-month cooldown

Usage:
    source .career-ops-env/bin/activate
    python career-ops-germany/integrations/gmail_bridge.py

    # Or with uv:
    uv run python career-ops-germany/integrations/gmail_bridge.py

Environment:
    GMAIL_CREDS_PATH  — path to Google OAuth credentials JSON
"""

import csv
import datetime
import os
import re
import sys
from pathlib import Path
from typing import Optional

# ── Path setup ──────────────────────────────────────────────────────
GERMANY_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = GERMANY_ROOT

# Parent project files (written by gmail_sync.py)
UPSTREAM_APPS_CSV = PROJECT_ROOT / "data" / "applications.csv"
UPSTREAM_REJECTIONS_CSV = PROJECT_ROOT / "data" / "rejections.csv"
UPSTREAM_APPS_MD = PROJECT_ROOT / "data" / "applications.md"

# Germany-specific files
DE_APPS_MD = GERMANY_ROOT / "data" / "applications.md"
DE_BURN_LIST = GERMANY_ROOT / "data" / "burn-list.tsv"
DE_SCAN_HISTORY = GERMANY_ROOT / "data" / "scan-history.tsv"

# Burn list cooldown period
BURN_COOLDOWN_MONTHS = 6


def normalize_company(name: str) -> str:
    """Strip legal suffixes and whitespace for fuzzy matching.

    Args:
        name: Raw company name string.

    Returns:
        Cleaned, lowercase company name.
    """
    name = re.sub(
        r"(?i)\b(gmbh|inc\.?|llc|corp|group|ag|ltd\.?|se|kg|e\.v\.)\b",
        "",
        name,
    )
    name = re.sub(r"[,.()\-]+$", "", name).strip()
    return name.lower()


def load_burn_list() -> list[dict]:
    """Load existing burn list entries.

    Returns:
        List of dicts with keys: company, rejection_date, role,
        reason, earliest_reapply.
    """
    entries: list[dict] = []
    if not DE_BURN_LIST.exists():
        return entries

    with open(DE_BURN_LIST, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            entries.append(row)
    return entries


def save_burn_list(entries: list[dict]) -> None:
    """Write burn list back to TSV.

    Args:
        entries: List of burn list dicts.
    """
    fieldnames = [
        "company",
        "rejection_date",
        "role",
        "reason",
        "earliest_reapply",
    ]
    with open(DE_BURN_LIST, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, delimiter="\t", extrasaction="ignore"
        )
        writer.writeheader()
        for entry in entries:
            writer.writerow(entry)


def is_company_burned(company: str, burn_list: list[dict]) -> bool:
    """Check if a company is already in the burn list.

    Args:
        company: Company name to check.
        burn_list: Current burn list entries.

    Returns:
        True if company is already tracked.
    """
    normalized = normalize_company(company)
    for entry in burn_list:
        if normalize_company(entry.get("company", "")) == normalized:
            return True
    return False


def add_to_burn_list(
    company: str,
    role: str,
    rejection_date: str,
    reason: str = "Auto-detected from Gmail rejection email",
) -> bool:
    """Add a rejected company to the burn list.

    Args:
        company: Company name.
        role: Role that was rejected.
        rejection_date: Date of rejection (YYYY-MM-DD).
        reason: Reason for rejection.

    Returns:
        True if added, False if already exists.
    """
    burn_list = load_burn_list()

    if is_company_burned(company, burn_list):
        print(f"  ⚠️  {company} already in burn list — skipping")
        return False

    # Calculate earliest reapply date (6 months from rejection)
    try:
        rej_date = datetime.datetime.strptime(rejection_date, "%Y-%m-%d")
    except ValueError:
        rej_date = datetime.datetime.now()

    reapply_date = rej_date + datetime.timedelta(
        days=BURN_COOLDOWN_MONTHS * 30
    )

    entry = {
        "company": company,
        "rejection_date": rejection_date,
        "role": role,
        "reason": reason,
        "earliest_reapply": reapply_date.strftime("%Y-%m-%d"),
    }

    burn_list.append(entry)
    save_burn_list(burn_list)
    print(
        f"  🔴 Added {company} to burn list "
        f"(reapply after {reapply_date.strftime('%Y-%m-%d')})"
    )
    return True


def parse_de_tracker() -> tuple[list[dict], list[str]]:
    """Parse the Germany applications.md tracker.

    Returns:
        Tuple of (parsed application dicts, raw file lines).
    """
    if not DE_APPS_MD.exists():
        return [], []

    with open(DE_APPS_MD, "r", encoding="utf-8") as f:
        lines = f.readlines()

    apps: list[dict] = []
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if (
            stripped.startswith("|")
            and "Company" not in stripped
            and "---" not in stripped
            and "----" not in stripped
        ):
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 8:
                apps.append(
                    {
                        "index": idx,
                        "line": line,
                        "id": parts[1],
                        "date": parts[2],
                        "company": parts[3],
                        "role": parts[4],
                        "score": parts[5],
                        "status": parts[6],
                    }
                )
    return apps, lines


def get_max_tracker_id(apps: list[dict]) -> int:
    """Get the highest application ID from the tracker.

    Args:
        apps: Parsed application entries.

    Returns:
        Highest numeric ID found, or 0.
    """
    max_id = 0
    for app in apps:
        try:
            app_id = int(app["id"])
            max_id = max(max_id, app_id)
        except (ValueError, TypeError):
            continue
    return max_id


def sync_rejections_to_burn_list() -> int:
    """Read upstream rejections CSV and add new ones to burn list.

    Returns:
        Number of new entries added to burn list.
    """
    if not UPSTREAM_REJECTIONS_CSV.exists():
        print(
            f"⚠️  No rejections CSV found at {UPSTREAM_REJECTIONS_CSV}\n"
            "   Run gmail_sync.py first."
        )
        return 0

    added = 0
    with open(UPSTREAM_REJECTIONS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = row.get("Company", "").strip()
            role = row.get("Role", "").strip()
            date = row.get("Date", "").strip()

            if not company or company == "Unknown Company":
                continue

            if add_to_burn_list(company, role, date):
                added += 1

    return added


def sync_upstream_to_de_tracker() -> int:
    """Mirror upstream applications.csv into Germany tracker.

    Only adds entries that don't already exist (by company name match).

    Returns:
        Number of new entries added.
    """
    if not UPSTREAM_APPS_CSV.exists():
        print(
            f"⚠️  No applications CSV at {UPSTREAM_APPS_CSV}\n"
            "   Run gmail_sync.py first."
        )
        return 0

    apps, lines = parse_de_tracker()
    existing_companies = {
        normalize_company(a["company"]) for a in apps
    }
    max_id = get_max_tracker_id(apps)

    # Read upstream CSV
    new_entries: list[str] = []
    with open(UPSTREAM_APPS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = row.get("Company", "").strip()
            if not company or company == "Unknown Company":
                continue

            if normalize_company(company) in existing_companies:
                continue

            max_id += 1
            date = row.get("Date", "")
            role = row.get("Role", "Unknown")
            status = row.get("Status", "Applied")
            notes = row.get("Notes", "Synced from Gmail")

            new_line = (
                f"| {max_id} | {date} | {company} | {role} "
                f"| 0.0/5 | {status} | ❌ | N/A | {notes} |\n"
            )
            new_entries.append(new_line)
            existing_companies.add(normalize_company(company))
            print(f"  ➕ Added {company} — {role} ({status})")

    if new_entries:
        # Find the insertion point (after last data row, or after header)
        insert_idx = len(lines)
        for app in reversed(apps):
            insert_idx = app["index"] + 1
            break

        for i, entry in enumerate(new_entries):
            lines.insert(insert_idx + i, entry)

        with open(DE_APPS_MD, "w", encoding="utf-8") as f:
            f.writelines(lines)

    return len(new_entries)


def run_upstream_sync() -> bool:
    """Execute the upstream gmail_sync.py.

    Returns:
        True if sync completed successfully.
    """
    sys.path.insert(0, str(PROJECT_ROOT))
    try:
        # Import and run the upstream sync
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "gmail_sync", PROJECT_ROOT / "scripts" / "gmail_sync.py"
        )
        if spec is None or spec.loader is None:
            print("❌ Could not load gmail_sync.py")
            return False

        module = importlib.util.module_from_spec(spec)

        # Set working directory to project root (gmail_sync uses relative paths)
        original_cwd = os.getcwd()
        os.chdir(PROJECT_ROOT)

        try:
            spec.loader.exec_module(module)
            module.check_emails()
            return True
        except Exception as e:
            print(f"❌ Gmail sync failed: {e}")
            return False
        finally:
            os.chdir(original_cwd)

    except Exception as e:
        print(f"❌ Could not import gmail_sync: {e}")
        return False


def print_burn_list_status() -> None:
    """Print current burn list summary."""
    burn_list = load_burn_list()
    if not burn_list:
        print("\n📋 Burn list: empty")
        return

    today = datetime.datetime.now()
    print(f"\n📋 Burn list: {len(burn_list)} companies")
    print("-" * 60)

    for entry in burn_list:
        company = entry.get("company", "?")
        rej_date = entry.get("rejection_date", "?")
        role = entry.get("role", "?")
        reapply = entry.get("earliest_reapply", "?")

        try:
            reapply_dt = datetime.datetime.strptime(reapply, "%Y-%m-%d")
            days_left = (reapply_dt - today).days
            if days_left > 0:
                status = f"🔴 BLOCKED ({days_left}d remaining)"
            elif days_left > -30:
                status = "🟡 CAUTION (window just opened)"
            else:
                status = "🟢 CLEAR (reapply ok)"
        except ValueError:
            status = "❓ Unknown"

        print(f"  {company:30s} | {role:30s} | {status}")

    print("-" * 60)


def main() -> None:
    """Run the full Gmail → Career-Ops Germany sync pipeline."""
    print("=" * 60)
    print("  Gmail ↔ Career-Ops Germany Sync")
    print("=" * 60)

    # Step 1: Run upstream Gmail sync
    print("\n[1/3] Running upstream Gmail sync...")
    success = run_upstream_sync()
    if not success:
        print(
            "\n⚠️  Upstream sync failed. Will try to process existing data..."
        )

    # Step 2: Sync rejections → burn list
    print("\n[2/3] Syncing rejections to burn list...")
    burn_added = sync_rejections_to_burn_list()
    print(f"  → {burn_added} new companies added to burn list")

    # Step 3: Mirror upstream tracker → Germany tracker
    print("\n[3/3] Mirroring applications to Germany tracker...")
    apps_added = sync_upstream_to_de_tracker()
    print(f"  → {apps_added} new applications added to tracker")

    # Summary
    print_burn_list_status()

    print("\n✅ Sync complete.")
    print(f"  Burn list: {DE_BURN_LIST}")
    print(f"  Tracker:   {DE_APPS_MD}")


if __name__ == "__main__":
    main()
