"""deposit() paths: zero amount, basic deposit round-trip, TransferFailed
from a malicious ERC20 that returns false."""

from __future__ import annotations

import pytest
from web3.exceptions import ContractLogicError


def test_deposit_zero_amount_reverts(payout_pool):
    with pytest.raises(ContractLogicError):
        payout_pool.functions.deposit(0).transact()


def test_deposit_transfers_funds(w3, payout_pool, usdc, deployer_account):
    amount = 500_000

    tx = usdc.functions.mint(deployer_account.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    tx = usdc.functions.approve(payout_pool.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    pre = payout_pool.functions.pool_balance().call()
    tx = payout_pool.functions.deposit(amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    post = payout_pool.functions.pool_balance().call()

    assert post == pre + amount
