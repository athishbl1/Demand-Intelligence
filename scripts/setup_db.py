#!/usr/bin/env python3
"""Create every table, policy and function of the project: runs supabase/*.sql in file-name order.

    python3 scripts/setup_db.py --dry-run    # list the files that would run
    python3 scripts/setup_db.py              # run them against SUPABASE_DB_URL

The files are idempotent (create ... if not exists, drop constraint if exists), so you can run this again.
This only creates the structure. To load the CSV data afterwards run:

    python3 scripts/migrate_to_supabase.py --enrich

Needs psql on PATH and SUPABASE_DB_URL (see .env.example). The URL is never printed.
"""
import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _env  # noqa: E402

ROOT = _env.ROOT
SQL_DIR = ROOT / "supabase"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="only list the files")
    args = ap.parse_args()

    files = sorted(SQL_DIR.glob("*.sql"))
    if not files:
        sys.exit(f"No .sql files in {SQL_DIR}")
    print("Order:")
    for f in files:
        print("  ", f.name)
    if args.dry_run:
        return

    url = _env.require("SUPABASE_DB_URL", "(the Postgres connection string of your Supabase)")
    for f in files:
        r = subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", str(f)],
                           text=True, capture_output=True)
        if r.returncode != 0:
            err = (r.stderr or "").replace(url, "<SUPABASE_DB_URL>")
            sys.exit(f"FAILED in {f.name}:\n{err}")
        print(f"ok  {f.name}")
    print("Done. Next: python3 scripts/migrate_to_supabase.py --enrich")


if __name__ == "__main__":
    main()
