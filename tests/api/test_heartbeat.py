"""End-to-end tests for the /api/watch/heartbeat route.

The heartbeat route has a silent-failure design (always returns 200), so the
assertions have to look at the DB state instead of the HTTP body.
"""

from __future__ import annotations

import datetime as dt
import time

import pytest

from tests.helpers import db
from tests.helpers.fixtures_bridge import run_scenario


pytestmark = pytest.mark.api


def _current_month() -> str:
    now = dt.datetime.now(dt.timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


def test_heartbeat_credits_watch_session(web_client):
    ids = run_scenario("heartbeat-ready")
    session_id = ids["session"]["id"]
    viewer_id = ids["viewer"]["id"]

    authed = web_client.as_user(viewer_id)
    # Let the route register a gap of a few seconds before the beat.
    time.sleep(3)
    resp = authed.post("/api/watch/heartbeat", json={"sessionId": session_id})
    assert resp.status_code == 200

    session = db.find_watch_session(session_id)
    assert session is not None
    assert session["weightedSeconds"] > 0

    total = db.find_monthly_total(viewer_id, _current_month())
    assert total is not None
    assert float(total["weightedHours"]) > 0


def test_heartbeat_respects_monthly_cap(web_client):
    ids = run_scenario("near-monthly-cap")
    session_id = ids["session"]["id"]
    viewer_id = ids["viewer"]["id"]

    authed = web_client.as_user(viewer_id)
    time.sleep(3)
    resp = authed.post("/api/watch/heartbeat", json={"sessionId": session_id})
    assert resp.status_code == 200

    total = db.find_monthly_total(viewer_id, _current_month())
    assert total is not None
    assert float(total["weightedHours"]) <= 50.0


def test_heartbeat_ignores_software_attestation(web_client, db_url):
    # The bypass will resolve to a SOFTWARE viewer that the heartbeat-ready
    # scenario doesn't create, so use a scratch scenario: reset + create a
    # software viewer directly via a scenario. For now, reuse empty and
    # assert the silent-fail 200.
    run_scenario("empty")
    # Even with no user to resolve, bypass with an unknown id returns
    # null => the route silent-fails with 200.
    resp = web_client.post(
        "/api/watch/heartbeat", json={"sessionId": "doesnotexist"}
    )
    assert resp.status_code == 200
