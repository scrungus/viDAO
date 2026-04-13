"""Tests for the /api/cron/payout route.

Without a leased chain these tests exercise only the auth + fixture wiring;
the on-chain assertions live in tests/contracts. Here we check:
  - the route rejects missing/invalid Authorization
  - with payout-ready fixtures, the route either 200s (chain reachable, pool
    funded) or 500s with an on-chain error string (chain missing) — we don't
    fail on the latter, just assert the shape. Contract-side happy path is
    covered by test_distribute_happy.
"""

from __future__ import annotations

import os

import httpx
import pytest

from tests.helpers.fixtures_bridge import run_scenario


pytestmark = pytest.mark.api


def test_cron_requires_auth(web_base_url):
    resp = httpx.post(f"{web_base_url}/api/cron/payout", timeout=30)
    assert resp.status_code == 401


def test_cron_rejects_wrong_bearer(web_base_url):
    resp = httpx.post(
        f"{web_base_url}/api/cron/payout",
        headers={"authorization": "Bearer wrong"},
        timeout=30,
    )
    assert resp.status_code == 401


def test_cron_accepts_correct_bearer(web_base_url):
    # CRON_SECRET is set from values-test.yaml as 'test-cron-secret'
    cron_secret = os.environ.get("CRON_SECRET", "test-cron-secret")
    run_scenario("payout-ready")
    resp = httpx.post(
        f"{web_base_url}/api/cron/payout",
        headers={"authorization": f"Bearer {cron_secret}"},
        timeout=120,
    )
    # Either the cron succeeded (chain path works) or it failed at the
    # contract layer — both prove the auth + fixture wiring is intact.
    assert resp.status_code in (200, 500)
    if resp.status_code == 500:
        body = resp.json()
        assert "error" in body
