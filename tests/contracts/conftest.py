"""Session fixtures for contract tests.

All tests in this package require the `chain_lease` fixture from the root
conftest, which leases a fresh Nitro devnode from the chainpool service with
MockUSDC and PayoutPool already deployed + initialized.

Tests that need an adversarial ERC20 or a reentry harness deploy those on
demand using bytecode from `contracts/artifacts-cache/`.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from eth_account import Account
from web3 import Web3

from tests.helpers.chain import contract_at, load_abi, make_web3

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "contracts" / "artifacts-cache"


pytestmark = pytest.mark.contracts


def _load_bytecode(name: str) -> str:
    path = ARTIFACTS_DIR / f"{name}.bytecode.hex"
    return path.read_text().strip()


@pytest.fixture(scope="session")
def deployer_account(chain_lease):
    return Account.from_key(chain_lease["deployer_key"])


@pytest.fixture(scope="session")
def w3(chain_lease, deployer_account) -> Web3:
    return make_web3(chain_lease["rpc_url"], signer_key=deployer_account.key.hex())


@pytest.fixture(scope="session")
def payout_pool(w3, chain_lease):
    return contract_at(w3, chain_lease["contracts"]["payout_pool"], "payout-pool")


@pytest.fixture(scope="session")
def usdc(w3, chain_lease):
    return contract_at(w3, chain_lease["contracts"]["usdc"], "mock-usdc")


@pytest.fixture(scope="session")
def chain_id(w3) -> int:
    return w3.eth.chain_id


def deploy_contract(
    w3: Web3,
    deployer: Account,
    abi_name: str,
    constructor_args: tuple = (),
) -> object:
    abi = load_abi(abi_name)
    bytecode = _load_bytecode(abi_name)
    factory = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = factory.constructor(*constructor_args).build_transaction(
        {
            "from": deployer.address,
            "nonce": w3.eth.get_transaction_count(deployer.address),
            "gas": 5_000_000,
            "gasPrice": w3.eth.gas_price,
        }
    )
    signed = deployer.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    assert receipt.status == 1, f"deploy {abi_name} failed: {receipt}"
    return w3.eth.contract(address=receipt.contractAddress, abi=abi)


@pytest.fixture
def malicious_usdc(w3, deployer_account):
    return deploy_contract(w3, deployer_account, "malicious-erc20")


@pytest.fixture
def reentrant_receiver(w3, deployer_account):
    return deploy_contract(w3, deployer_account, "reentrant-receiver")


@pytest.fixture(scope="session")
def creator_accounts():
    return [Account.create() for _ in range(3)]


@pytest.fixture(scope="session")
def non_owner():
    return Account.create()
