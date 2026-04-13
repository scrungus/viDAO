"""Direct read-only psycopg2 helpers for assertions.

Never use these to seed data — scenario scripts own that. Tests should only
read through this module to verify side effects of API calls.
"""

from __future__ import annotations

import contextlib
import os
from typing import Any

import psycopg2
import psycopg2.extras


@contextlib.contextmanager
def connect():
    conn = psycopg2.connect(os.environ["VIDAO_DB_URL"])
    try:
        conn.set_session(readonly=True, autocommit=True)
        yield conn
    finally:
        conn.close()


def fetch_one(sql: str, params: tuple | None = None) -> dict[str, Any] | None:
    with connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            row = cur.fetchone()
            return dict(row) if row else None


def fetch_all(sql: str, params: tuple | None = None) -> list[dict[str, Any]]:
    with connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return [dict(r) for r in cur.fetchall()]


def find_user_by_email(email: str) -> dict[str, Any] | None:
    return fetch_one(
        'SELECT * FROM "User" WHERE email = %s LIMIT 1', (email,)
    )


def find_watch_session(session_id: str) -> dict[str, Any] | None:
    return fetch_one(
        'SELECT * FROM "WatchSession" WHERE id = %s', (session_id,)
    )


def find_monthly_total(user_id: str, month: str) -> dict[str, Any] | None:
    return fetch_one(
        'SELECT * FROM "MonthlyWatchTotal" WHERE "userId" = %s AND month = %s',
        (user_id, month),
    )
