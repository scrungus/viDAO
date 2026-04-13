"""Initialization path tests.

The chainpool service initializes PayoutPool at provision time, so by the time
tests run `initialized` is already true. We verify:

  - double-init reverts AlreadyInitialized
  - [xfail-strict] front-run re-init attack is fixable: a second initialize()
    from a non-deployer should NOT be able to hijack the owner. The current
    contract guards this via the `initialized` flag, so as long as the
    chainpool initializes immediately after deploy the attack window is zero.
    This xfail is a *pin* for when the project moves to a deploy-and-init
    separation model; if someone accidentally splits the two, the test flips
    to pass and the strict marker turns it into a failure.
"""

from __future__ import annotations

import pytest
from web3.exceptions import ContractLogicError


def test_double_init_reverts(payout_pool, chain_lease):
    usdc_addr = chain_lease["contracts"]["usdc"]
    with pytest.raises(ContractLogicError):
        payout_pool.functions.initialize(usdc_addr).transact()


@pytest.mark.xfail_known
@pytest.mark.xfail(
    strict=True,
    reason="pins deploy/init atomicity — see plan Phase 6",
)
def test_reinit_front_run_window_exists(payout_pool, chain_lease):
    # If someone ever introduces a deploy-and-init separation, this test will
    # start succeeding (reinit works) and flip the strict xfail into a failure.
    # The chainpool flow atomically inits so this call always reverts today.
    payout_pool.functions.initialize(chain_lease["contracts"]["usdc"]).transact()
