"""Pydantic request/response schemas for the chainpool HTTP API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ContractAddresses(BaseModel):
    usdc: str
    payout_pool: str
    deployer: str


class LeaseRequest(BaseModel):
    ttl_seconds: int | None = Field(default=None, ge=1, le=86400)


class LeaseResponse(BaseModel):
    lease_id: str
    chain_id: str
    rpc_url: str
    ws_url: str
    deployer_key: str
    expires_at: datetime
    contracts: ContractAddresses


class HeartbeatResponse(BaseModel):
    lease_id: str
    expires_at: datetime


class StatusChain(BaseModel):
    name: str
    state: str
    lease_id: str | None = None
    age_seconds: float
    expires_at: datetime | None = None


class StatusResponse(BaseModel):
    idle: int
    leased: int
    starting: int
    max: int
    chains: list[StatusChain]
