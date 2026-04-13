"""Arithmetic overflow in distribute()'s sum accumulator.

**Highest priority test.** The contract does `total = total + *amount` in a
loop and later compares `total > pool`. If U256 add wraps instead of panicking,
an attacker could pass `[U256::MAX, 1, legitimate_amount]` and get `total == 0`,
passing the balance check and draining the pool.

Stylus/Rust U256 should panic on overflow (debug/release both check arithmetic
on U256 via checked add), reverting the whole call. This test *asserts the
revert* and is a pin: if the behavior ever silently wraps, this goes red.
"""

from __future__ import annotations

import pytest
from web3.exceptions import ContractLogicError

U256_MAX = (1 << 256) - 1


def test_overflow_in_sum_reverts(payout_pool, creator_accounts):
    creators = [creator_accounts[0].address, creator_accounts[1].address]
    amounts = [U256_MAX, 1]  # sum wraps to 0 if unchecked
    with pytest.raises(ContractLogicError):
        payout_pool.functions.distribute(creators, amounts).transact()


def test_overflow_three_term_reverts(payout_pool, creator_accounts):
    creators = [c.address for c in creator_accounts]
    amounts = [U256_MAX, 1, 10]
    with pytest.raises(ContractLogicError):
        payout_pool.functions.distribute(creators, amounts).transact()
