"""Gas usage at large batch sizes. Soft-assertion only — prints a budget
report but never fails CI. Marked `slow` so the normal run skips it."""

from __future__ import annotations

import pytest
from eth_account import Account

pytestmark = [pytest.mark.slow]


@pytest.mark.parametrize("count", [100, 500])
def test_large_batch_gas_usage(
    w3, payout_pool, usdc, deployer_account, count
):
    total = count  # 1 unit each
    tx = usdc.functions.mint(deployer_account.address, total).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    tx = usdc.functions.transfer(payout_pool.address, total).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    creators = [Account.create().address for _ in range(count)]
    amounts = [1] * count

    tx = payout_pool.functions.distribute(creators, amounts).transact()
    receipt = w3.eth.wait_for_transaction_receipt(tx)

    print(f"\n[gas] distribute count={count} gas_used={receipt.gasUsed}")
    assert receipt.status == 1
