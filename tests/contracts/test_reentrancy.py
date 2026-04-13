"""Reentrancy checks.

Distribute is owner-gated and MockUSDC.transfer is a pure state write with no
callback, so classic reentrancy via the receiver is impossible here. The
ReentrantReceiver exists to prove the *defensive* property: any attempt to
re-enter from outside the owner account must fail.
"""

from __future__ import annotations


def test_reentrant_receiver_cannot_reenter(
    w3, payout_pool, reentrant_receiver, creator_accounts
):
    reentrant_receiver.functions.arm(
        payout_pool.address,
        [creator_accounts[0].address],
        [1],
    ).transact()
    w3.eth.wait_for_transaction_receipt(
        reentrant_receiver.functions.tryReenter().transact()
    )
    # reentry attempted from a non-owner address — must not have succeeded
    assert reentrant_receiver.functions.attempted().call() is True
    assert reentrant_receiver.functions.reenterSucceeded().call() is False
