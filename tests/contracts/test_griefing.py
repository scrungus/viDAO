"""Griefing edge cases:
  - zero amount entries mixed in a batch — contract skips them, others still paid
  - direct token transfer bypassing deposit() — pool_balance() reflects it live
"""

from __future__ import annotations


def _fund_pool(usdc, payout_pool, deployer_account, amount: int):
    w3 = usdc.w3
    tx = usdc.functions.mint(deployer_account.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    tx = usdc.functions.transfer(payout_pool.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)


def test_zero_amount_entries_are_skipped(
    w3, payout_pool, usdc, deployer_account, creator_accounts
):
    _fund_pool(usdc, payout_pool, deployer_account, 10)

    creators = [c.address for c in creator_accounts]
    amounts = [10, 0, 0]  # only first creator should receive

    pre_balances = [usdc.functions.balanceOf(c).call() for c in creators]
    tx = payout_pool.functions.distribute(creators, amounts).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    post_balances = [usdc.functions.balanceOf(c).call() for c in creators]

    assert post_balances[0] == pre_balances[0] + 10
    assert post_balances[1] == pre_balances[1]
    assert post_balances[2] == pre_balances[2]


def test_direct_transfer_reflected_in_pool_balance(
    w3, payout_pool, usdc, deployer_account
):
    pre = payout_pool.functions.pool_balance().call()

    amount = 12_345
    tx = usdc.functions.mint(deployer_account.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    tx = usdc.functions.transfer(payout_pool.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    post = payout_pool.functions.pool_balance().call()
    assert post == pre + amount
