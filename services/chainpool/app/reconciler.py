"""Background reconciler: maintains `min_idle` warm chains up to `max_size`,
reaps failed/expired pods, and times out leases past their TTL.

Runs as a single asyncio task started from the FastAPI lifespan. Safe to cancel.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from . import k8s
from .deployer import DeployError, deploy_contracts
from .settings import settings
from .store import ChainRecord, Store

log = logging.getLogger(__name__)


class Reconciler:
    def __init__(self, store: Store) -> None:
        self.store = store
        self._ready_once = asyncio.Event()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._loop(), name="reconciler")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    @property
    def ready(self) -> bool:
        return self._ready_once.is_set()

    async def _loop(self) -> None:
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("reconciler tick failed")
            self._ready_once.set()
            await asyncio.sleep(settings.reconciler_interval_seconds)

    async def _tick(self) -> None:
        await self._sync_from_cluster()
        await self._expire_leases()
        await self._prune_failed()
        await self._provision_idle_if_needed()

    async def _sync_from_cluster(self) -> None:
        try:
            pods = k8s.list_chains()
        except Exception:
            log.exception("list_chains failed")
            return

        known = {rec.name for rec in await self.store.list()}
        seen: set[str] = set()
        for pod in pods:
            meta = pod.get("metadata") or {}
            name = meta.get("name")
            if not name:
                continue
            seen.add(name)
            if name in known:
                continue
            labels = meta.get("labels") or {}
            state = labels.get("chainpool/state", "starting")
            rec = ChainRecord(
                name=name,
                state=state,
                created_at=meta.get("creation_timestamp")
                or datetime.now(timezone.utc),
                rpc_url=f"http://{name}.{settings.namespace}.svc:8547",
                ws_url=f"ws://{name}.{settings.namespace}.svc:8548",
            )
            await self.store.upsert(rec)

        for name in known - seen:
            await self.store.remove(name)

    async def _expire_leases(self) -> None:
        expired = await self.store.expire_leases()
        for rec in expired:
            log.info("lease %s expired on chain %s", rec.lease_id, rec.name)

    async def _prune_failed(self) -> None:
        for rec in list(await self.store.list()):
            if rec.state == "failed":
                log.info("reaping failed chain %s", rec.name)
                try:
                    k8s.delete_chain(rec.name)
                except Exception:
                    log.exception("delete_chain(%s) failed", rec.name)
                await self.store.remove(rec.name)

    async def _provision_idle_if_needed(self) -> None:
        chains = await self.store.list()
        idle = [c for c in chains if c.state == "idle"]
        deficit = max(0, settings.min_idle - len(idle))
        headroom = max(0, settings.max_size - len(chains))
        to_make = min(deficit, headroom)
        for _ in range(to_make):
            asyncio.create_task(self._provision_one())

    async def _provision_one(self) -> None:
        try:
            info = k8s.create_chain_pod()
        except Exception:
            log.exception("create_chain_pod failed")
            return

        rec = ChainRecord(
            name=info.name,
            state="starting",
            created_at=datetime.now(timezone.utc),
            rpc_url=info.rpc_url,
            ws_url=info.ws_url,
        )
        await self.store.upsert(rec)

        ready = await k8s.wait_ready(
            info.name, timeout=settings.chain_ready_timeout_seconds
        )
        if not ready:
            log.warning("chain %s failed TCP readiness", info.name)
            rec.state = "failed"
            await self.store.upsert(rec)
            return

        try:
            result = await deploy_contracts(info.rpc_url)
        except DeployError as exc:
            log.warning("deploy failed on %s: %s", info.name, exc)
            rec.state = "failed"
            await self.store.upsert(rec)
            return

        rec.usdc = result.usdc
        rec.payout_pool = result.payout_pool
        rec.deployer = result.deployer
        rec.state = "idle"
        await self.store.upsert(rec)
        k8s.set_pod_state_label(info.name, "idle")
        log.info(
            "chain %s ready: usdc=%s pool=%s",
            info.name,
            result.usdc,
            result.payout_pool,
        )
