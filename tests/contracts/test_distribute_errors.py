"""distribute() error paths: LengthMismatch, InsufficientPool."""

from __future__ import annotations

import pytest
from web3.exceptions import ContractLogicError


def test_length_mismatch_reverts(payout_pool, creator_accounts):
    creators = [c.address for c in creator_accounts]
    amounts = [1, 2]  # shorter than creators
    with pytest.raises(ContractLogicError):
        payout_pool.functions.distribute(creators, amounts).transact()


def test_insufficient_pool_reverts(payout_pool, creator_accounts):
    pool_bal = payout_pool.functions.pool_balance().call()
    over = pool_bal + 1
    creators = [creator_accounts[0].address]
    amounts = [over]
    with pytest.raises(ContractLogicError):
        payout_pool.functions.distribute(creators, amounts).transact()
