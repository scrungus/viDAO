"""pool_balance() pins the live-ERC20 contract: it must always equal
IERC20.balanceOf(pool_address), across deposit, distribute, and direct
transfer-in edge cases."""

from __future__ import annotations


def test_pool_balance_matches_erc20_balanceof_after_mint_transfer(
    w3, payout_pool, usdc, deployer_account
):
    amount = 7_777
    tx = usdc.functions.mint(deployer_account.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    tx = usdc.functions.transfer(payout_pool.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    raw = usdc.functions.balanceOf(payout_pool.address).call()
    live = payout_pool.functions.pool_balance().call()
    assert raw == live


def test_pool_balance_after_partial_distribute(
    w3, payout_pool, usdc, deployer_account, creator_accounts
):
    amount = 1000
    tx = usdc.functions.mint(deployer_account.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)
    tx = usdc.functions.transfer(payout_pool.address, amount).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    tx = payout_pool.functions.distribute(
        [creator_accounts[0].address], [400]
    ).transact()
    w3.eth.wait_for_transaction_receipt(tx)

    raw = usdc.functions.balanceOf(payout_pool.address).call()
    live = payout_pool.functions.pool_balance().call()
    assert raw == live
