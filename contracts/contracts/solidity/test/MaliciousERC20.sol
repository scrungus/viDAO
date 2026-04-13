// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Adversarial ERC20 used exclusively by the contract test suite.
/// Toggles let each test pick the failure mode without redeploying:
///   - `failTransfer` / `failTransferFrom`: return false (ERC20-false path)
///   - `revertTransfer` / `revertTransferFrom`: revert hard
///   - `balanceOfOverride`: hand PayoutPool a fake balance on view reads
///
/// Reentrancy is driven from `ReentrantReceiver`, not from here.
contract MaliciousERC20 {
    string public name = "Malicious USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOfRaw;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    bool public failTransfer;
    bool public failTransferFrom;
    bool public revertTransfer;
    bool public revertTransferFrom;
    bool public balanceOfOverrideEnabled;
    uint256 public balanceOfOverride;

    event Transfer(address indexed from, address indexed to, uint256 value);

    function setFailTransfer(bool v) external { failTransfer = v; }
    function setFailTransferFrom(bool v) external { failTransferFrom = v; }
    function setRevertTransfer(bool v) external { revertTransfer = v; }
    function setRevertTransferFrom(bool v) external { revertTransferFrom = v; }
    function setBalanceOfOverride(bool enabled, uint256 v) external {
        balanceOfOverrideEnabled = enabled;
        balanceOfOverride = v;
    }

    function mint(address to, uint256 amount) external {
        balanceOfRaw[to] += amount;
        totalSupply += amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        if (balanceOfOverrideEnabled) return balanceOfOverride;
        return balanceOfRaw[account];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (revertTransfer) revert("malicious revert transfer");
        if (failTransfer) return false;
        require(balanceOfRaw[msg.sender] >= amount, "insufficient");
        balanceOfRaw[msg.sender] -= amount;
        balanceOfRaw[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (revertTransferFrom) revert("malicious revert transferFrom");
        if (failTransferFrom) return false;
        require(balanceOfRaw[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "no allowance");
        allowance[from][msg.sender] -= amount;
        balanceOfRaw[from] -= amount;
        balanceOfRaw[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
