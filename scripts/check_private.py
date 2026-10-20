#!/usr/bin/env python3
"""Check the production image's anonymous boundary, with no real identity/key."""
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

base = sys.argv[1].rstrip("/")
http = build_opener(NoRedirect)
deadline = time.monotonic() + 60
while True:
    try:
        with http.open(base + "/healthz", timeout=3) as response:
            assert json.load(response) == {"status": "UP"}
        break
    except (URLError, TimeoutError, ConnectionError):
        if time.monotonic() >= deadline:
            raise SystemExit("Private server did not become healthy; inspect its configuration.")
        time.sleep(1)

for path in ["/", "/runtime.js", "/brand-policy.json", "/style-guide/index.html"]:
    try:
        http.open(base + path)
        raise AssertionError("Anonymous access unexpectedly succeeded: " + path)
    except HTTPError as error:
        assert error.code == 302 and error.headers["Location"].endswith("/signin.html"), path

for path in ["/api/session", "/api/health", "/api/access", "/api/workspace/projects", "/api/workspace/projects/00000000-0000-0000-0000-000000000000/blobs/00000000-0000-0000-0000-000000000000"]:
    try:
        http.open(base + path)
        raise AssertionError("Anonymous API access unexpectedly succeeded: " + path)
    except HTTPError as error:
        assert error.code == 401, path

try:
    http.open(base + "/oauth2/authorization/corporate")
    raise AssertionError("Expected corporate authorization redirect")
except HTTPError as error:
    assert error.code == 302
    assert error.headers["Location"].startswith("https://accounts.google.com/")
    cookies = error.headers.get_all("Set-Cookie", [])
    assert any("HttpOnly" in cookie and "Secure" in cookie and "SameSite=Lax" in cookie for cookie in cookies)

with http.open(base + "/signin.html") as response:
    assert "Continue with corporate Google" in response.read().decode()
print("Private container smoke passed: corporate sign-in, private pages/API/files, secure session cookie and minimal health check. No provider call used.")
