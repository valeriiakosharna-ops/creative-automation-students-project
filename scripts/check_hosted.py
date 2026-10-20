#!/usr/bin/env python3
"""Check the deployed app with no credentials and no paid provider requests."""
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

base = sys.argv[1].rstrip("/")
deadline = time.monotonic() + 60
while True:
    try:
        with urlopen(base + "/api/health", timeout=3) as response:
            health = json.load(response)
        break
    except (URLError, TimeoutError, ConnectionError):
        if time.monotonic() >= deadline:
            raise SystemExit("Hosted server did not become healthy within 60 seconds.")
        time.sleep(1)
assert health["clientKeysEnabled"] is True, health
assert health["aiConfigured"] is False, "Hosted mode must not expose a shared owner key."
with urlopen(base + "/runtime.js") as response:
    runtime = response.read().decode()
    assert response.headers["Cache-Control"] == "no-store"
    assert "connect-src 'self'" in response.headers["Content-Security-Policy"]
assert json.loads(runtime.removeprefix("window.STUDIO_RUNTIME = ").strip().rstrip(";"))["clientKeysEnabled"] is True
for path, marker in [("/", "Creative Automation Studio"), ("/style-guide/index.html", "guide-version"), ("/quickstart.md", "Render")]:
    with urlopen(base + path) as response:
        assert marker in response.read().decode(), path
with urlopen(base + "/brand-policy.json") as response:
    assert json.load(response)["version"] == health["styleGuideVersion"]
brief = {
    "title": "Hosted smoke test", "description": "A student workshop", "date": "2026-11-21",
    "timeZone": "Europe/Kyiv", "sourceLanguage": "en", "formats": ["facebook"], "languages": ["en"],
    "variants": 1, "colors": ["#00A6EB", "#E60036", "#302A40"],
}
payload = {"brief": brief, "styleGuideVersion": health["styleGuideVersion"],
           "outputs": [{"id": "facebook-en-1", "format": "facebook", "language": "en", "variant": 1}]}
try:
    urlopen(Request(base + "/api/copy", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}))
    raise AssertionError("Hosted generation accepted a request without a visitor key.")
except HTTPError as error:
    assert error.code == 428, error.code
    assert "this visit" in json.load(error)["message"]
try:
    # Simulate a browser POST through the hosting platform's HTTPS ingress.
    urlopen(Request(base + "/api/copy", data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "Origin": "https://studio.example.org",
        "X-Forwarded-Proto": "https", "X-Forwarded-Host": "studio.example.org", "X-Forwarded-Port": "443",
    }))
    raise AssertionError("Proxied hosted generation accepted a request without a visitor key.")
except HTTPError as error:
    assert error.code == 428, "HTTPS ingress broke same-origin checks: " + str(error.code)
print("Hosted smoke passed: same-server UI, guide/policy, runtime, headers, and mandatory visitor key. No AI credits used.")
