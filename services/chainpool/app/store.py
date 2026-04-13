"""In-memory lease store. Crash-restart loses leases; pytest handles that
by using session fixtures with explicit teardown, and the reconciler reaps
any chains left in `leased` state whose lease_id is unknown."""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


@dataclass
class ChainRecord:
    name: str
    state: str  # starting | idle | leased | failed
    created_at: datetime
    rpc_url: str
    ws_url: str
    usdc: str = ""
    payout_pool: str = ""
    deployer: str = ""
    lease_id: str | None = None
    expires_at: datetime | None = None


class Store:
    def __init__(self) -> None:
        self._chains: dict[str, ChainRecord] = {}
        self._lock = asyncio.Lock()

    async def upsert(self, rec: ChainRecord) -> None:
        async with self._lock:
            self._chains[rec.name] = rec

    async def remove(self, name: str) -> None:
        async with self._lock:
            self._chains.pop(name, None)

    async def get(self, name: str) -> ChainRecord | None:
        async with self._lock:
            return self._chains.get(name)

    async def by_lease(self, lease_id: str) -> ChainRecord | None:
        async with self._lock:
            for rec in self._chains.values():
                if rec.lease_id == lease_id and rec.state == "leased":
                    return rec
            return None

    async def list(self) -> list[ChainRecord]:
        async with self._lock:
            return list(self._chains.values())

    async def acquire_idle(self, ttl_seconds: int) -> ChainRecord | None:
        async with self._lock:
            for rec in self._chains.values():
                if rec.state == "idle":
                    rec.state = "leased"
                    rec.lease_id = uuid.uuid4().hex
                    rec.expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=ttl_seconds
                    )
                    return rec
            return None

    async def release(self, lease_id: str) -> bool:
        async with self._lock:
            for rec in self._chains.values():
                if rec.lease_id == lease_id and rec.state == "leased":
                    rec.state = "failed"  # destroy after release — no reuse
                    return True
            return False

    async def extend(
        self, lease_id: str, ttl_seconds: int
    ) -> ChainRecord | None:
        async with self._lock:
            for rec in self._chains.values():
                if rec.lease_id == lease_id and rec.state == "leased":
                    rec.expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=ttl_seconds
                    )
                    return rec
            return None

    async def expire_leases(self) -> list[ChainRecord]:
        now = datetime.now(timezone.utc)
        expired: list[ChainRecord] = []
        async with self._lock:
            for rec in self._chains.values():
                if (
                    rec.state == "leased"
                    and rec.expires_at is not None
                    and rec.expires_at < now
                ):
                    rec.state = "failed"
                    expired.append(rec)
        return expired
