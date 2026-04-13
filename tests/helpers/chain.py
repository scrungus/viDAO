"""web3.py client + contract ABI helpers.

ABI loading is lazy because we don't generate them until the chainpool
service has compiled the contracts at least once. Tests marked `contracts`
use these helpers through the session-scoped chain_lease fixture.
"""

from __future__ import annotations

import functools
import json
from pathlib import Path
from typing import Any

from eth_account import Account
from web3 import Web3
from web3.contract import Contract
from web3.middleware import SignAndSendRawMiddlewareBuilder


REPO_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = REPO_ROOT / "contracts" / "artifacts-cache"


@functools.lru_cache(maxsize=8)
def load_abi(name: str) -> list[dict[str, Any]]:
    path = ARTIFACTS_DIR / f"{name}.abi.json"
    if not path.exists():
        raise FileNotFoundError(
            f"ABI {name} not found at {path}. Run the chainpool image build "
            "or compile-and-cache.ts to generate artifacts."
        )
    return json.loads(path.read_text())


def make_web3(rpc_url: str, signer_key: str | None = None) -> Web3:
    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    if signer_key:
        account = Account.from_key(signer_key)
        w3.middleware_onion.inject(
            SignAndSendRawMiddlewareBuilder.build(account), layer=0
        )
        w3.eth.default_account = account.address
    return w3


def contract_at(
    w3: Web3, address: str, abi_name: str
) -> Contract:
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=load_abi(abi_name))
