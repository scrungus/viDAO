// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPayoutPool {
    function distribute(address[] calldata creators, uint256[] calldata amounts) external;
}

/// @notice When it receives a token transfer it tries to re-enter PayoutPool.distribute.
/// The reentry should revert because distribute() is owner-gated and this contract
/// is never the owner; we assert that the double-call does NOT succeed.
contract ReentrantReceiver {
    IPayoutPool public pool;
    address[] public creators;
    uint256[] public amounts;
    bool public attempted;
    bool public reenterSucceeded;

    function arm(
        address _pool,
        address[] calldata _creators,
        uint256[] calldata _amounts
    ) external {
        pool = IPayoutPool(_pool);
        delete creators;
        delete amounts;
        for (uint256 i = 0; i < _creators.length; i++) {
            creators.push(_creators[i]);
            amounts.push(_amounts[i]);
        }
        attempted = false;
        reenterSucceeded = false;
    }

    // Called by MaliciousERC20 on balance updates via a hook would be ideal,
    // but MaliciousERC20 doesn't call hooks. Instead the test wires this
    // contract as a `creator` — MockUSDC.transfer() is a pure state update so
    // we can't reenter from there. Keep this callable directly for the test
    // to manually attempt reentry while inside a distribute() call.
    function tryReenter() external {
        attempted = true;
        try pool.distribute(creators, amounts) {
            reenterSucceeded = true;
        } catch {
            reenterSucceeded = false;
        }
    }
}
