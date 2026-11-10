"""Tiny helper to read settings for the scripts in this folder.

Order: real environment variable, then .env.local, then .env (both in the repository root).
Values are never printed. Standard library only.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _from_file(path, name):
    if not path.exists():
        return None
    for line in path.read_text().splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == name:
            return value.strip().strip('"').strip("'") or None
    return None


def get(name, default=None):
    value = os.environ.get(name) or _from_file(ROOT / ".env.local", name) or _from_file(ROOT / ".env", name)
    return value or default


def require(name, hint=""):
    value = get(name)
    if not value:
        raise SystemExit(f"ERROR: {name} is not set. Copy .env.example to .env.local and fill it in. {hint}".strip())
    return value
