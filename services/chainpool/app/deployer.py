"""Per-chain contract deployment.

Shells out to the existing `contracts/scripts/deploy-and-publish.ts` script,
which handles the tricky Stylus deploy+activate flow via the hardhat-arbitrum-
stylus plugin. The script reads `ARB_RPC_URL` / `DEPLOYER_PRIVATE_KEY` from env
and writes `{usdc, payoutPool, deployer, chainId}` JSON to `ADDRESSES_OUT`.

Cargo + cargo-stylus are baked into the chainpool image; compiled wasm is cached
in the image layer so per-chain deploy is activation-only (~5-10s) instead of a
full recompile.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from dataclasses import dataclass

from .settings import settings

log = logging.getLogger(__name__)


@dataclass
class DeployResult:
    usdc: str
    payout_pool: str
    deployer: str


class DeployError(RuntimeError):
    pass


async def deploy_contracts(rpc_url: str) -> DeployResult:
    """Deploy MockUSDC + PayoutPool to `rpc_url`. Raises DeployError on failure."""
    with tempfile.NamedTemporaryFile(
        mode="r", suffix=".json", delete=False
    ) as tmp:
        out_path = tmp.name

    env = os.environ.copy()
    env["ARB_RPC_URL"] = rpc_url
    env["DEPLOYER_PRIVATE_KEY"] = settings.dev_private_key
    env["ADDRESSES_OUT"] = out_path

    contracts_dir = os.path.join(settings.artifacts_dir, "contracts")
    log.info("deploying contracts to %s", rpc_url)

    proc = await asyncio.create_subprocess_exec(
        "npx",
        "tsx",
        "scripts/deploy-and-publish.ts",
        cwd=contracts_dir,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    try:
        stdout, _ = await asyncio.wait_for(
            proc.communicate(), timeout=settings.deployer_timeout_seconds
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise DeployError(
            f"deploy timed out after {settings.deployer_timeout_seconds}s"
        )

    if proc.returncode != 0:
        tail = (stdout or b"").decode("utf-8", errors="replace")[-2000:]
        raise DeployError(f"deploy failed rc={proc.returncode}: {tail}")

    try:
        with open(out_path, "r") as f:
            payload = json.load(f)
    except FileNotFoundError:
        raise DeployError("deploy script did not write addresses file")
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass

    return DeployResult(
        usdc=payload["usdc"],
        payout_pool=payload["payoutPool"],
        deployer=payload["deployer"],
    )
