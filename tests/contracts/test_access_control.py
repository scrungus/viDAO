"""distribute() is owner-only — non-owner calls must revert NotOwner
and leave balances untouched."""

from __future__ import annotations

import pytest
from eth_account import Account
from web3 import Web3
from web3.exceptions import ContractLogicError

from tests.helpers.chain import make_web3, contract_at


@pytest.fixture
def non_owner_w3(chain_lease, non_owner):
    # Fund non_owner from deployer so it can pay gas
    owner = Account.from_key(chain_lease["deployer_key"])
    w3 = make_web3(chain_lease["rpc_url"], signer_key=owner.key.hex())
    tx = w3.eth.send_transaction(
        {
            "from": owner.address,
            "to": non_owner.address,
            "value": Web3.to_wei(0.1, "ether"),
        }
    )
    w3.eth.wait_for_transaction_receipt(tx)
    return make_web3(chain_lease["rpc_url"], signer_key=non_owner.key.hex())


def test_non_owner_distribute_reverts(non_owner_w3, chain_lease, creator_accounts):
    pool = contract_at(
        non_owner_w3, chain_lease["contracts"]["payout_pool"], "payout-pool"
    )
    creators = [c.address for c in creator_accounts]
    amounts = [1, 1, 1]
    with pytest.raises(ContractLogicError):
        pool.functions.distribute(creators, amounts).transact()


def test_owner_can_call_distribute_empty(payout_pool):
    # Sanity: owner path works even with empty arrays (no-op)
    tx = payout_pool.functions.distribute([], []).transact()
    receipt = payout_pool.w3.eth.wait_for_transaction_receipt(tx)
    assert receipt.status == 1
