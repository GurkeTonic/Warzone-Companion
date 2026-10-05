"""The only way to ESI. Every tool that talks to esi.evetech.net goes through
this module, so the rules of developers.eveonline.com/docs/services/esi are
kept in one place (read in full on 5.10.2026):

  User agent    App/version, contact e-mail and source URL on every request
                (best-practices: "Strongly Preferred").
  Versioning    X-Compatibility-Date as a header (overview: the query
                parameter is only for clients that cannot set headers).
  Caching       "You should not update before [expires] ... Circumventing the
                ESI caching can get you banned." A response is kept until its
                `expires`; before that the cached body is returned without a
                request. After it, the request carries If-None-Match with the
                last ETag, and a 304 reuses the cached body (1 token, not 2).
                The cache lives in CACHE_DIR; the workflows carry it from run
                to run with actions/cache.
  Error limit   X-ESI-Error-Limit-Remain is read on every response. Below
                ERROR_FLOOR the client stops sending requests for the rest of
                the run (Halted), long before ESI answers 420.
  Rate limit    X-Ratelimit-Remaining/-Limit are read per group. Below a tenth
                of the bucket the client slows down, below RATE_FLOOR it stops
                (rate-limiting: "Don't operate at the limit"). A 429 is
                honoured with its Retry-After once, if it is short; otherwise
                the run stops sending.
  Errors        420 stops the run. 5xx is retried twice with back-off (costs no
                tokens). Other 4xx are raised to the caller once, not retried.

Stdlib only. Shared verbatim between Warzone-Companion and eve-freelancer.
"""
import email.utils
import hashlib
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ERROR_FLOOR = 20        # stop when fewer errors than this are left in the window
RATE_FLOOR = 0.05       # stop when less than 5 % of a bucket is left
RATE_SLOW = 0.10        # slow down below 10 %
MAX_RETRY_AFTER = 30    # seconds we are willing to wait for a single 429


class Halted(Exception):
    """ESI asked us (or is about) to stop. No further requests this run."""


class Client:
    def __init__(self, base, compat_date, user_agent, cache_dir):
        self.base = base
        self.compat = compat_date
        self.ua = user_agent
        self.cache = Path(cache_dir)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.halted = None
        self.stats = {"requests": 0, "ok": 0, "not_modified": 0, "cache_hits": 0,
                      "errors": 0, "error_remain_min": None, "rate": {}}

    # ---------- cache ----------

    def _key(self, method, path, params, body, compat):
        raw = json.dumps([method, path, sorted((params or {}).items()), body, compat])
        return hashlib.sha1(raw.encode()).hexdigest()

    def _load(self, key):
        try:
            return json.loads((self.cache / f"{key}.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None

    def _store(self, key, entry):
        tmp = self.cache / f"{key}.json.tmp"
        tmp.write_text(json.dumps(entry, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, self.cache / f"{key}.json")

    @staticmethod
    def _expires(headers):
        value = headers.get("Expires")
        if not value:
            return 0
        try:
            return email.utils.parsedate_to_datetime(value).timestamp()
        except (TypeError, ValueError):
            return 0

    # ---------- budget ----------

    def _watch(self, headers):
        """Read error and rate limit headers; slow down or halt."""
        with self.lock:
            remain = headers.get("X-ESI-Error-Limit-Remain")
            if remain is not None:
                r = int(remain)
                m = self.stats["error_remain_min"]
                self.stats["error_remain_min"] = r if m is None else min(m, r)
                if r < ERROR_FLOOR:
                    self.halted = f"error limit: {r} left"
            group = headers.get("X-Ratelimit-Group")
            left = headers.get("X-Ratelimit-Remaining")
            limit = headers.get("X-Ratelimit-Limit")  # e.g. "150/15m"
            slow = False
            if group and left is not None and limit:
                total = int(limit.split("/")[0])
                left = int(left)
                g = self.stats["rate"].setdefault(group, {"limit": limit, "min_left": left})
                g["min_left"] = min(g["min_left"], left)
                if left < total * RATE_FLOOR:
                    self.halted = f"rate limit {group}: {left}/{limit} left"
                elif left < total * RATE_SLOW:
                    slow = True
        if slow:
            time.sleep(2)

    # ---------- requests ----------

    def get(self, path, params=None, compat=None):
        return self._call("GET", path, params, None, compat)

    def post(self, path, body, compat=None):
        """POST routes carry no cache headers; results are not cached."""
        return self._call("POST", path, None, body, compat)

    def _call(self, method, path, params, body, compat):
        compat = compat or self.compat
        key = self._key(method, path, params, body, compat)
        entry = self._load(key) if method == "GET" else None
        now = time.time()
        if entry and now < entry.get("expires", 0):
            with self.lock:
                self.stats["cache_hits"] += 1
            return entry["body"]
        if self.halted:
            raise Halted(self.halted)

        url = self.base + path
        if params:
            url += "?" + urllib.parse.urlencode(params)
        headers = {"Accept": "application/json", "User-Agent": self.ua,
                   "X-Compatibility-Date": compat}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if entry and entry.get("etag"):
            headers["If-None-Match"] = entry["etag"]

        for attempt in range(3):
            with self.lock:
                self.stats["requests"] += 1
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=30) as res:
                    payload = json.load(res)
                    self._watch(res.headers)
                    with self.lock:
                        self.stats["ok"] += 1
                    if method == "GET":
                        self._store(key, {"path": path, "body": payload,
                                          "etag": res.headers.get("ETag"),
                                          "expires": self._expires(res.headers)})
                    return payload
            except urllib.error.HTTPError as e:
                self._watch(e.headers)
                if e.code == 304 and entry:
                    with self.lock:
                        self.stats["not_modified"] += 1
                    entry["expires"] = self._expires(e.headers) or entry.get("expires", 0)
                    if e.headers.get("ETag"):
                        entry["etag"] = e.headers["ETag"]
                    self._store(key, entry)
                    return entry["body"]
                with self.lock:
                    self.stats["errors"] += 1
                if e.code == 420:
                    self.halted = "ESI answered 420 (error limit reached)"
                    raise Halted(self.halted) from None
                if e.code == 429:
                    wait = int(e.headers.get("Retry-After") or 0)
                    if attempt == 0 and 0 < wait <= MAX_RETRY_AFTER:
                        time.sleep(wait)
                        continue
                    self.halted = f"ESI answered 429 on {path} (Retry-After {wait}s)"
                    raise Halted(self.halted) from None
                if e.code >= 500 and attempt < 2:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                if attempt < 2:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise
        raise RuntimeError(f"ESI {path}: gave up")

    def summary(self):
        s = self.stats
        rate = ", ".join(f"{g} min {v['min_left']} of {v['limit']}" for g, v in s["rate"].items()) or "-"
        return (f"ESI: {s['requests']} requests ({s['ok']} 200, {s['not_modified']} 304, "
                f"{s['errors']} errors), {s['cache_hits']} served from cache before expiry; "
                f"error limit min {s['error_remain_min']}; rate {rate}"
                + (f"; HALTED: {self.halted}" if self.halted else ""))


def prune(cache_dir, max_age_days=3):
    """Drop cache entries nobody used for a while (keeps actions/cache small)."""
    cutoff = time.time() - max_age_days * 86400
    for p in Path(cache_dir).glob("*.json"):
        if p.stat().st_mtime < cutoff:
            p.unlink()
