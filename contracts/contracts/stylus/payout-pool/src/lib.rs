//! PayoutPool — viDAO subscription pool contract
//!
//! Holds USDC deposits from subscriber payments and distributes them
//! to creators proportionally by verified watch hours. Owner-gated
//! distribute function called by the weekly payout cron.
//!
//! Deployed on Arbitrum Sepolia (testnet) for the MVP.

// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use alloy_sol_types::SolError;
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    prelude::*,
};
use alloy_sol_types::sol;

// ERC20 interface for USDC interactions
sol_interface! {
    interface IERC20 {
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function transfer(address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }
}

sol_storage! {
    #[entrypoint]
    pub struct PayoutPool {
        address owner;
        address usdc_token;
        uint256 pool_balance;
        bool initialized;
    }
}

// Custom errors
sol! {
    error NotOwner();
    error AlreadyInitialized();
    error NotInitialized();
    error InsufficientPool(uint256 requested, uint256 available);
    error LengthMismatch();
    error TransferFailed();
    error ZeroAmount();
}

#[public]
impl PayoutPool {
    /// Initialize the contract with owner and USDC token address.
    /// Can only be called once.
    pub fn initialize(&mut self, usdc_token: Address) -> Result<(), Vec<u8>> {
        if self.initialized.get() {
            return Err(AlreadyInitialized {}.abi_encode());
        }
        self.owner.set(self.vm().msg_sender());
        self.usdc_token.set(usdc_token);
        self.initialized.set(true);
        Ok(())
    }

    /// Deposit USDC into the payout pool.
    /// Caller must have approved this contract to spend `amount` USDC.
    pub fn deposit(&mut self, amount: U256) -> Result<(), Vec<u8>> {
        if !self.initialized.get() {
            return Err(NotInitialized {}.abi_encode());
        }
        if amount == U256::ZERO {
            return Err(ZeroAmount {}.abi_encode());
        }

        let usdc_addr = self.usdc_token.get();
        let usdc = IERC20::new(usdc_addr);
        let sender = self.vm().msg_sender();
        let this = self.vm().contract_address();
        let ctx = Call::new_mutating(self);

        let success = usdc.transfer_from(self.vm(), ctx, sender, this, amount)?;
        if !success {
            return Err(TransferFailed {}.abi_encode());
        }

        let current = self.pool_balance.get();
        self.pool_balance.set(current + amount);
        Ok(())
    }

    /// Distribute USDC from the pool to creators. Owner only.
    /// `creators` and `amounts` must be the same length.
    /// Sum of `amounts` must not exceed `pool_balance`.
    pub fn distribute(
        &mut self,
        creators: Vec<Address>,
        amounts: Vec<U256>,
    ) -> Result<(), Vec<u8>> {
        if !self.initialized.get() {
            return Err(NotInitialized {}.abi_encode());
        }
        if self.vm().msg_sender() != self.owner.get() {
            return Err(NotOwner {}.abi_encode());
        }
        if creators.len() != amounts.len() {
            return Err(LengthMismatch {}.abi_encode());
        }

        // Calculate total and validate against pool balance
        let mut total = U256::ZERO;
        for amount in &amounts {
            total = total + *amount;
        }

        let pool = self.pool_balance.get();
        if total > pool {
            return Err(InsufficientPool {
                requested: total,
                available: pool,
            }
            .abi_encode());
        }

        // Transfer to each creator
        let usdc_addr = self.usdc_token.get();
        let usdc = IERC20::new(usdc_addr);

        for i in 0..creators.len() {
            if amounts[i] > U256::ZERO {
                let ctx = Call::new_mutating(self);
                let success = usdc.transfer(self.vm(), ctx, creators[i], amounts[i])?;
                if !success {
                    return Err(TransferFailed {}.abi_encode());
                }
            }
        }

        self.pool_balance.set(pool - total);
        Ok(())
    }

    /// Returns the current pool balance.
    pub fn pool_balance(&self) -> U256 {
        self.pool_balance.get()
    }

    /// Returns the owner address.
    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    /// Returns the USDC token address.
    pub fn usdc_token(&self) -> Address {
        self.usdc_token.get()
    }
}
