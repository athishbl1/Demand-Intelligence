#!/usr/bin/env python3
"""Create the n8n workflows from workflows/*.json through the n8n public API.

    python3 scripts/import_workflows.py --dry-run               # show what would be created, no network
    python3 scripts/import_workflows.py                         # create the core workflows
    python3 scripts/import_workflows.py --activate              # also publish the ones with a webhook or schedule
    python3 scripts/import_workflows.py --all                   # include the old prototypes (enrich, reason-tool)
    python3 scripts/import_workflows.py --update                # overwrite workflows that already exist by name

Settings (environment or .env.local, see .env.example):
    N8N_BASE_URL                 e.g. https://your-n8n.example.com   (no trailing /webhook)
    N8N_API_KEY                  n8n -> Settings -> n8n API -> Create an API key
    N8N_POSTGRES_CREDENTIAL_ID   id of the Postgres credential that points at your Supabase
    N8N_LLM_CREDENTIAL_ID        id of the OpenAI-compatible credential (chat completions)

Find a credential id in the n8n editor: open the credential, the id is in the address bar (.../credentials/<id>).
The exported files keep credential ids as null, so this script fills them in from the two settings above.
Workflows that already exist (same name) are skipped unless you pass --update.
Standard library only.
"""
import argparse
import json
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _env  # noqa: E402

ROOT = _env.ROOT
WF_DIR = ROOT / "workflows"

# Sub-order matters little, but the demo feed should exist before the demo workflow pushes to it.
CORE = ["api-overview", "agent", "strategy", "demo-feed", "demo"]
OLD = ["enrich", "reason-tool"]
# A workflow can only be activated if it has a webhook or schedule trigger.
ACTIVATABLE = {"api-overview", "agent", "strategy", "demo-feed", "enrich", "reason-tool"}
CRED_TYPE_TO_SETTING = {"postgres": "N8N_POSTGRES_CREDENTIAL_ID", "openAiApi": "N8N_LLM_CREDENTIAL_ID"}
KEEP_SETTINGS = {"executionOrder", "timezone", "saveDataErrorExecution", "saveDataSuccessExecution",
                 "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow"}
DEFAULT_BASE = "https://n8n.oi.destination.one"


def ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


class N8n:
    def __init__(self, base, key):
        self.base, self.key, self.ctx = base.rstrip("/"), key, ssl_context()

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{self.base}/api/v1{path}", data=data, method=method,
                                     headers={"X-N8N-API-KEY": self.key, "Content-Type": "application/json",
                                              "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60, context=self.ctx) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:400]
            raise SystemExit(f"n8n answered {e.code} for {method} {path}: {detail}")
        except urllib.error.URLError as e:
            raise SystemExit(f"Cannot reach n8n at {self.base}: {e.reason}")

    def existing(self):
        found, cursor = {}, None
        while True:
            page = self.call("GET", "/workflows?limit=100" + (f"&cursor={cursor}" if cursor else ""))
            for w in page.get("data", []):
                found[w["name"]] = w["id"]
            cursor = page.get("nextCursor")
            if not cursor:
                return found


def prepare(name, webhook_base):
    """Read one export and return the body the public API accepts."""
    raw = json.loads((WF_DIR / f"{name}.json").read_text())
    nodes = raw["nodes"]
    missing = set()
    for node in nodes:
        for ctype, ref in (node.get("credentials") or {}).items():
            setting = CRED_TYPE_TO_SETTING.get(ctype)
            cred_id = _env.get(setting) if setting else None
            if cred_id:
                ref["id"] = cred_id
            else:
                missing.add(setting or ctype)
        # The demo workflow posts to its own feed webhook; point it at this n8n.
        url = node.get("parameters", {}).get("url")
        if isinstance(url, str) and "/webhook/team-07-" in url:
            node["parameters"]["url"] = f"{webhook_base}/team-07-" + url.split("/webhook/team-07-", 1)[1]
    settings = {k: v for k, v in (raw.get("settings") or {}).items() if k in KEEP_SETTINGS}
    body = {"name": raw["name"], "nodes": nodes, "connections": raw["connections"], "settings": settings}
    return body, sorted(missing)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="no network, only show what would happen")
    ap.add_argument("--activate", action="store_true", help="publish workflows that have a webhook or schedule")
    ap.add_argument("--update", action="store_true", help="overwrite workflows that already exist by name")
    ap.add_argument("--all", action="store_true", help="also import the old prototypes")
    ap.add_argument("only", nargs="*", help="optional workflow file names (without .json)")
    args = ap.parse_args()

    names = args.only or (CORE + (OLD if args.all else []))
    base = (_env.get("N8N_BASE_URL") or DEFAULT_BASE).rstrip("/")
    webhook_base = f"{base}/webhook"

    n8n, existing = None, {}
    if not args.dry_run:
        n8n = N8n(base, _env.require("N8N_API_KEY", "(n8n -> Settings -> n8n API)"))
        existing = n8n.existing()

    for name in names:
        if not (WF_DIR / f"{name}.json").exists():
            print(f"skip  {name}: workflows/{name}.json not found")
            continue
        body, missing = prepare(name, webhook_base)
        label = body["name"]
        if missing:
            print(f"warn  {label}: no value for {', '.join(missing)}; the node will have no credential")
        if args.dry_run:
            print(f"plan  {label}: {len(body['nodes'])} nodes")
            continue
        if label in existing and not args.update:
            print(f"skip  {label}: exists (id {existing[label]}), use --update to overwrite")
            continue
        if label in existing:
            wf_id = existing[label]
            n8n.call("PUT", f"/workflows/{wf_id}", body)
            print(f"upd   {label} (id {wf_id})")
        else:
            wf_id = n8n.call("POST", "/workflows", body)["id"]
            print(f"new   {label} (id {wf_id})")
        if args.activate and name in ACTIVATABLE:
            n8n.call("POST", f"/workflows/{wf_id}/activate")
            print(f"live  {label}")

    if not args.dry_run:
        print("Done. Open n8n and check every workflow once. Credentials listed as 'warn' still need to be set.")


if __name__ == "__main__":
    main()
