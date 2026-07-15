"""Single source of truth for everything CCP requires identical on every
ESI/war-report request: contact identification and the compatibility date.

Used by every Python tool that talks to ESI or the war report API
(serve.py, build_static_data.py, mirror_warzone.py, update_sde.py) and by
tools/build_pages.py, which writes the same three values into js/config.js
for the browser-side client (js/esi.js) — so there is exactly one place to
edit when the contact address, app version, or compatibility date changes.
"""

APP_NAME = "WarzoneCompanion"
APP_VERSION = "0.4"
CONTACT_EMAIL = "webmaster@tonicbeacon.com"
REPO_URL = "https://github.com/GurkeTonic/Warzone-Companion"

USER_AGENT = f"{APP_NAME}/{APP_VERSION} ({CONTACT_EMAIL}; +{REPO_URL})"

ESI_BASE = "https://esi.evetech.net"
COMPAT_DATE = "2026-06-09"
