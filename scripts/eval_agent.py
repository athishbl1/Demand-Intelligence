#!/usr/bin/env python3
"""Evaluate the Change Explainer (POST team-07-agent) on labelled periods (workflows/agent-eval/cases.json).

    python3 scripts/eval_agent.py            # fresh answers (force: one AI call per case)
    python3 scripts/eval_agent.py --cached   # reuse saved answers where the logic is current (no AI calls)

Scores per case: top reason as expected, no symptom/location finding presented as a reason, change type, and the
measured unexplained share. Also prints the top reason the previous logic (findings-v1/v2) gave for the same period,
read from saved answers in Supabase (needs psql + SUPABASE_DB_URL in .env.local; skipped if not available).
Standard library only.
"""
import argparse
import json
import os
import subprocess
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _env  # noqa: E402

WEBHOOK_BASE = _env.get("N8N_WEBHOOK_BASE", "https://n8n.oi.destination.one/webhook").rstrip("/")
URL = f"{WEBHOOK_BASE}/team-07-agent"


def ssl_context():
    """Verified TLS; python.org builds on macOS ship without CA certs: use certifi or the system bundle."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for cafile in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
        if Path(cafile).exists():
            return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


SSL = ssl_context()


def call(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180, context=SSL) as r:
        return json.load(r)


def old_answers():
    """scope_key -> top finding id of the newest answer saved by an older logic."""
    url = _env.get("SUPABASE_DB_URL")
    if not url:
        return {}
    sql = ("select json_object_agg(scope_key, top) from (select distinct on (scope_key) scope_key, "
           "coalesce(reasons->0->>'finding_id', reasons->0->>'title') as top from team_07_explanations "
           "where coalesce(answer->>'logic', '') not like 'drivers%' and reasons is not null order by scope_key, created_at desc) t")
    try:
        r = subprocess.run(["psql", url, "-X", "-q", "-t", "-A", "-c", sql], capture_output=True, text=True, timeout=60,
                           env={**os.environ, "PGCONNECT_TIMEOUT": "15"})
        return json.loads(r.stdout.strip() or "{}") or {}
    except Exception:
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cached", action="store_true")
    a = ap.parse_args()
    spec = json.loads((ROOT / "workflows/agent-eval/cases.json").read_text())
    forbid = set(spec["forbid_always"])
    old = old_answers()
    ok_top = ok_clean = ok_type = n = 0
    print(f"{'case':58s} {'type':18s} {'top reason':22s} {'unexpl':>6s}  result   (previous logic)")
    for cs in spec["cases"]:
        body = {"action": "explain", **cs["body"], "force": not a.cached}
        try:
            d = call(body)
        except Exception as e:
            print(f"{cs['name'][:58]:58s} ERROR {e}")
            continue
        n += 1
        reasons = d.get("reasons") or []
        ids = [r.get("finding_id") for r in reasons if r.get("kind") == "data"]
        top = ids[0] if ids else None
        bad = [i for i in ids if i in forbid]
        res = []
        if "expect_type" in cs:
            t_ok = d.get("change_type") == cs["expect_type"]
            ok_type += t_ok
            ok_top += t_ok
            res.append("type ok" if t_ok else "TYPE WRONG")
        else:
            exp = cs.get("expect_top")
            t_ok = top == exp or top in cs.get("allow_top", [])
            ok_top += t_ok
            ok_type += 1
            res.append("top ok" if t_ok else f"TOP WRONG (want {exp})")
        clean = not bad
        ok_clean += clean
        if bad:
            res.append(f"SYMPTOM AS REASON {bad}")
        sc = d.get("scope", {})
        prev = old.get(f"{sc.get('kind')}:{sc.get('from')}:{sc.get('to')}", "–")
        print(f"{cs['name'][:58]:58s} {d.get('change_type', '?'):18s} {str(top):22s} {str(d.get('unexplained_pct')):>6s}  {', '.join(res):8s} ({prev})")
    if n:
        print(f"\nTop reason correct: {ok_top}/{n}   no symptom/location as reason: {ok_clean}/{n}   change type: {ok_type}/{n}")


if __name__ == "__main__":
    main()
