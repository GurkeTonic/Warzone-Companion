#!/usr/bin/env python3
"""Keep the Cloudflare apex records in sync with Strato's dynamic hosting IP.

Background: tonicbeacon.com's DNS zone lives at Cloudflare, but the
WordPress hosting stays at Strato, which may rotate the webserver IP.
Strato's own nameservers keep serving their internal zone with the current
IP, so they act as the source of truth: this script asks them directly,
compares with the Cloudflare records, and updates Cloudflare on mismatch.

Runs on any Linux box (e.g. the monitoring VM) via cron, e.g. every 30 min:
  */30 * * * * CF_API_TOKEN=... CF_ZONE_ID=... /usr/bin/python3 /opt/sync_wp_ip.py

Requirements: python3 and dig (package: dnsutils / bind-utils).

Environment:
  CF_API_TOKEN     Cloudflare API token, permission "Zone / DNS / Edit"
                   for the tonicbeacon.com zone only
  CF_ZONE_ID       Zone ID (Cloudflare dashboard, overview page, right side)
  DISCORD_WEBHOOK  optional: webhook URL for change/error notifications
"""
import json
import os
import subprocess
import sys
import urllib.request

DOMAIN = "tonicbeacon.com"
STRATO_NS = ["shades13.rzone.de", "docks07.rzone.de"]
RECORD_TYPES = ["A", "AAAA"]
CF_API = "https://api.cloudflare.com/client/v4"

TOKEN = os.environ.get("CF_API_TOKEN")
ZONE = os.environ.get("CF_ZONE_ID")
WEBHOOK = os.environ.get("DISCORD_WEBHOOK")


def notify(message):
    print(message)
    if not WEBHOOK:
        return
    try:
        req = urllib.request.Request(
            WEBHOOK,
            data=json.dumps({"content": f"[sync_wp_ip] {message}"}).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=15).read()
    except Exception as err:
        print(f"discord notify failed: {err}")


def strato_answer(rtype):
    """Ask Strato's nameservers directly; first non-empty answer wins."""
    for ns in STRATO_NS:
        try:
            out = subprocess.run(
                ["dig", f"@{ns}", DOMAIN, rtype, "+short", "+time=5", "+tries=1"],
                capture_output=True, text=True, timeout=15,
            ).stdout.split()
            values = [v for v in out if v and not v.endswith(".")]
            if values:
                return sorted(values)
        except Exception:
            continue
    return []


def cf_request(method, path, payload=None):
    req = urllib.request.Request(
        f"{CF_API}{path}",
        method=method,
        data=json.dumps(payload).encode() if payload else None,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.load(res)
    if not data.get("success"):
        raise RuntimeError(f"cloudflare API error: {data.get('errors')}")
    return data["result"]


def main():
    if not TOKEN or not ZONE:
        sys.exit("CF_API_TOKEN and CF_ZONE_ID must be set")

    for rtype in RECORD_TYPES:
        truth = strato_answer(rtype)
        if not truth:
            notify(f"WARNING: Strato nameservers returned no {rtype} for {DOMAIN} "
                   "— zone may have been dropped; not touching Cloudflare.")
            continue

        records = cf_request(
            "GET", f"/zones/{ZONE}/dns_records?type={rtype}&name={DOMAIN}")
        current = sorted(r["content"] for r in records)

        if current == truth:
            print(f"{rtype}: in sync ({', '.join(truth)})")
            continue

        # Update existing records in place (typical case: exactly one record).
        for record, value in zip(records, truth):
            cf_request("PATCH", f"/zones/{ZONE}/dns_records/{record['id']}",
                       {"content": value})
        notify(f"{rtype} for {DOMAIN} updated: {', '.join(current)} "
               f"-> {', '.join(truth)} (Strato rotated the hosting IP)")


if __name__ == "__main__":
    main()
