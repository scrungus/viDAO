"""Happy-path distribute: 3 creators share the full pool; sum == pool pre-bal,
per-creator balances increment correctly, pool drains to zero."""

from __future__ import annotations

import pytest


def _fund_pool(usdc, payout_pool, deployer_account, amount: int):
    w3 = usdc.w3
    pool_addr = payout_pool.address

    tx = usdc.functions.mint(deployer_account.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    tx = usdc.functions.transfer(pool_addr, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)


def test_distribute_drains_pool(
    w3, payout_pool, usdc, deployer_account, creator_accounts
):
    amount_each = 1_000_000  # 1 USDC
    total = amount_each * len(creator_accounts)

    _fund_pool(usdc, payout_pool, deployer_account, total)

    pre_pool = payout_pool.functions.pool_balance().call()
    assert pre_pool >= total

    creators = [c.address for c in creator_accounts]
    amounts = [amount_each] * len(creators)

    tx = payout_pool.functions.distribute(creators, amounts).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    for c in creator_accounts:
        assert usdc.functions.balanceOf(c.address).call() == amount_each

    post_pool = payout_pool.functions.pool_balance().call()
    assert post_pool == pre_pool - total
