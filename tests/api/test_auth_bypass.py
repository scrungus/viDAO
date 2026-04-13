"""Smoke tests for the test-only auth bypass hook.

Proves that:
  - with NODE_ENV=test and a matching X-Test-Auth-Secret, the bypass is live
  - without the secret header, the real Privy path is still engaged (401)
  - the X-Test-Auth-User-Id header resolves to the seeded user row
"""

from __future__ import annotations

import httpx
import pytest

from tests.helpers.fixtures_bridge import run_scenario


pytestmark = pytest.mark.api


def test_bypass_accepts_seeded_user(web_base_url, test_auth_secret):
    ids = run_scenario("heartbeat-ready")
    viewer_id = ids["viewer"]["id"]

    # Register route bounces unauthenticated requests with 401. If the bypass
    # is wired correctly, passing only the secret + user id should resolve as
    # "authenticated as the seeded user" and the request hits upsert logic.
    resp = httpx.post(
        f"{web_base_url}/api/auth/register",
        headers={
            "x-test-auth-secret": test_auth_secret,
            "x-test-auth-user-id": viewer_id,
            "content-type": "application/json",
        },
        json={"attestationType": "HARDWARE"},
        timeout=30,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["userId"] == viewer_id


def test_bypass_requires_secret_header(web_base_url):
    # Without the secret, hitting a protected route should hit the real
    # Privy path and 401 out (no valid cookie/token).
    resp = httpx.post(
        f"{web_base_url}/api/auth/register",
        headers={"content-type": "application/json"},
        json={},
        timeout=30,
    )
    assert resp.status_code == 401


def test_bypass_rejects_wrong_secret(web_base_url):
    resp = httpx.post(
        f"{web_base_url}/api/auth/register",
        headers={
            "x-test-auth-secret": "definitely-not-the-secret",
            "x-test-auth-user-id": "whatever",
            "content-type": "application/json",
        },
        json={},
        timeout=30,
    )
    assert resp.status_code == 401
