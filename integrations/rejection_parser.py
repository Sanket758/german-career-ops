#!/usr/bin/env python3
"""Standalone rejection parser for Career-Ops Germany.

Reads the Germany tracker and auto-populates the burn list
from any entries with status "Rejected" or "REJECTED".

Use this when:
  - You manually update applications.md with a rejection
  - You want to backfill the burn list from existing data
  - Gmail sync is unavailable (no OAuth credentials)

Usage:
    uv run python career-ops-germany/integrations/rejection_parser.py

    # Dry run (show what would be added without writing):
    uv run python career-ops-germany/integrations/rejection_parser.py --dry-run
"""

import argparse
import csv
import datetime
import re
from pathlib import Path
from typing import Optional

GERMANY_ROOT = Path(__file__).resolve().parent.parent
DE_APPS_MD = GERMANY_ROOT / "data" / "applications.md"
DE_BURN_LIST = GERMANY_ROOT / "data" / "burn-list.tsv"
BURN_COOLDOWN_MONTHS = 6


def normalize_company(name: str) -> str:
    """Strip legal suffixes for fuzzy matching.

    Args:
        name: Raw company name.

    Returns:
        Cleaned lowercase name.
    """
    name = re.sub(
        r"(?i)\b(gmbh|inc\.?|llc|corp|group|ag|ltd\.?|se|kg|e\.v\.)\b",
        "",
        name,
    )
    return re.sub(r"[,.()\-]+$", "", name).strip().lower()


def load_burn_list() -> list[dict]:
    """Load existing burn list.

    Returns:
        List of burn list entries as dicts.
    """
    if not DE_BURN_LIST.exists():
        return []

    with open(DE_BURN_LIST, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def save_burn_list(entries: list[dict]) -> None:
    """Write burn list to TSV.

    Args:
        entries: Burn list entries.
    """
    fieldnames = [
        "company",
        "rejection_date",
        "role",
        "reason",
        "earliest_reapply",
    ]
    with open(DE_BURN_LIST, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t")
        writer.writeheader()
        for entry in entries:
            writer.writerow(entry)


def get_burned_companies(burn_list: list[dict]) -> set[str]:
    """Get normalized set of burned company names.

    Args:
        burn_list: Current burn list.

    Returns:
        Set of normalized company names.
    """
    return {
        normalize_company(e.get("company", ""))
        for e in burn_list
    }


def parse_rejections_from_tracker() -> list[dict]:
    """Find all rejected entries in the Germany tracker.

    Returns:
        List of dicts with company, role, date for rejected entries.
    """
    if not DE_APPS_MD.exists():
        print(f"⚠️  Tracker not found: {DE_APPS_MD}")
        return []

    rejections: list[dict] = []
    with open(DE_APPS_MD, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped.startswith("|"):
                continue
            if "Company" in stripped or "---" in stripped:
                continue

            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 8:
                continue

            status = parts[6].strip().upper()
            if status in ("REJECTED", "REJECTION"):
                rejections.append(
                    {
                        "company": parts[3].strip(),
                        "role": parts[4].strip(),
                        "date": parts[2].strip(),
                    }
                )

    return rejections


def main() -> None:
    """Parse tracker for rejections and add to burn list."""
    parser = argparse.ArgumentParser(
        description="Backfill burn list from tracker rejections"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be added without writing",
    )
    args = parser.parse_args()

    print("🔍 Scanning tracker for rejections...")
    rejections = parse_rejections_from_tracker()

    if not rejections:
        print("  No rejections found in tracker.")
        return

    print(f"  Found {len(rejections)} rejected entries.")

    burn_list = load_burn_list()
    burned = get_burned_companies(burn_list)
    added = 0

    for rej in rejections:
        company = rej["company"]
        if not company or company == "Unknown Company":
            continue

        if normalize_company(company) in burned:
            print(f"  ⚠️  {company} already in burn list — skip")
            continue

        # Calculate reapply date
        try:
            rej_date = datetime.datetime.strptime(
                rej["date"], "%Y-%m-%d"
            )
        except ValueError:
            rej_date = datetime.datetime.now()

        reapply = rej_date + datetime.timedelta(
            days=BURN_COOLDOWN_MONTHS * 30
        )

        entry = {
            "company": company,
            "rejection_date": rej["date"],
            "role": rej["role"],
            "reason": "Backfilled from tracker",
            "earliest_reapply": reapply.strftime("%Y-%m-%d"),
        }

        if args.dry_run:
            print(
                f"  [DRY RUN] Would add: {company} "
                f"(reapply after {reapply.strftime('%Y-%m-%d')})"
            )
        else:
            burn_list.append(entry)
            burned.add(normalize_company(company))
            print(
                f"  🔴 Added: {company} "
                f"(reapply after {reapply.strftime('%Y-%m-%d')})"
            )
        added += 1

    if not args.dry_run and added > 0:
        save_burn_list(burn_list)
        print(f"\n✅ Added {added} companies to burn list.")
    elif args.dry_run:
        print(f"\n📋 Dry run: {added} companies would be added.")
    else:
        print("\n✅ No new companies to add.")


if __name__ == "__main__":
    main()
