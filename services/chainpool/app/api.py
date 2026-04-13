"""FastAPI routes for the chainpool service."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response

from .models import (
    ContractAddresses,
    HeartbeatResponse,
    LeaseRequest,
    LeaseResponse,
    StatusChain,
    StatusResponse,
)
from .reconciler import Reconciler
from .settings import settings
from .store import Store

router = APIRouter()


def _store(req: Request) -> Store:
    return req.app.state.store


def _reconciler(req: Request) -> Reconciler:
    return req.app.state.reconciler


def _clamp_ttl(ttl: int | None) -> int:
    if ttl is None:
        return settings.lease_ttl_seconds
    return max(
        settings.lease_ttl_clamp_min, min(settings.lease_ttl_clamp_max, ttl)
    )


@router.post("/chains", response_model=LeaseResponse)
async def lease_chain(req: LeaseRequest, request: Request) -> LeaseResponse:
    ttl = _clamp_ttl(req.ttl_seconds)
    store = _store(request)
    rec = await store.acquire_idle(ttl)
    if rec is None:
        raise HTTPException(
            status_code=429, detail="pool exhausted — no idle chains"
        )
    assert rec.lease_id is not None
    assert rec.expires_at is not None
    return LeaseResponse(
        lease_id=rec.lease_id,
        chain_id=rec.name,
        rpc_url=rec.rpc_url,
        ws_url=rec.ws_url,
        deployer_key=settings.dev_private_key,
        expires_at=rec.expires_at,
        contracts=ContractAddresses(
            usdc=rec.usdc,
            payout_pool=rec.payout_pool,
            deployer=rec.deployer,
        ),
    )


@router.delete("/chains/{lease_id}", status_code=204)
async def release_chain(lease_id: str, request: Request) -> Response:
    store = _store(request)
    ok = await store.release(lease_id)
    if not ok:
        raise HTTPException(status_code=404, detail="unknown or expired lease")
    return Response(status_code=204)


@router.post(
    "/chains/{lease_id}/heartbeat", response_model=HeartbeatResponse
)
async def heartbeat(lease_id: str, request: Request) -> HeartbeatResponse:
    store = _store(request)
    rec = await store.extend(lease_id, settings.lease_ttl_seconds)
    if rec is None:
        raise HTTPException(status_code=404, detail="unknown or expired lease")
    assert rec.expires_at is not None
    return HeartbeatResponse(lease_id=lease_id, expires_at=rec.expires_at)


@router.get("/status", response_model=StatusResponse)
async def status(request: Request) -> StatusResponse:
    store = _store(request)
    chains = await store.list()
    now = datetime.now(timezone.utc)
    counts = {"idle": 0, "leased": 0, "starting": 0}
    chain_rows: list[StatusChain] = []
    for rec in chains:
        if rec.state in counts:
            counts[rec.state] += 1
        chain_rows.append(
            StatusChain(
                name=rec.name,
                state=rec.state,
                lease_id=rec.lease_id,
                age_seconds=(now - rec.created_at).total_seconds(),
                expires_at=rec.expires_at,
            )
        )
    return StatusResponse(
        idle=counts["idle"],
        leased=counts["leased"],
        starting=counts["starting"],
        max=settings.max_size,
        chains=chain_rows,
    )


@router.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


@router.get("/readyz")
async def readyz(request: Request) -> dict:
    rec = _reconciler(request)
    if not rec.ready:
        raise HTTPException(status_code=503, detail="reconciler warming up")
    store = _store(request)
    idle = sum(1 for c in await store.list() if c.state == "idle")
    if idle < 1:
        raise HTTPException(
            status_code=503, detail="no idle chains ready yet"
        )
    return {"ok": True, "idle": idle}
