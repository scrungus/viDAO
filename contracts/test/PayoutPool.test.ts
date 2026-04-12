import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, getAddress } from "viem";

describe("PayoutPool", async function () {
  const { stylusViem, viem } = await network.connect();

  // Helper: assert addresses equal (case-insensitive via checksumming)
  function assertAddress(actual: string, expected: string, msg?: string) {
    assert.equal(getAddress(actual), getAddress(expected), msg);
  }

  // Helper: assert that an async fn rejects with a revert
  async function assertReverts(fn: Promise<any>) {
    try {
      await fn;
      assert.fail("Expected transaction to revert");
    } catch (err: any) {
      assert.ok(
        err.message?.includes("reverted") || err.message?.includes("revert"),
        `Expected revert error, got: ${err.message?.slice(0, 100)}`
      );
    }
  }

  // Helper: deploy MockUSDC and PayoutPool, initialize, and fund
  async function setup() {
    const [owner, creator1, creator2, creator3, depositor] =
      await viem.getWalletClients();

    // Deploy MockUSDC (Solidity)
    const usdc = await stylusViem.deployContract("MockUSDC");

    // Deploy PayoutPool (Stylus/Rust)
    const pool = await stylusViem.deployContract("payout-pool");

    // Initialize PayoutPool with USDC address
    await pool.write.initialize([usdc.address], { account: owner.account });

    return { usdc, pool, owner, creator1, creator2, creator3, depositor };
  }

  // Helper: mint USDC, approve pool, and deposit
  async function fundPool(
    usdc: any,
    pool: any,
    depositor: any,
    amount: bigint
  ) {
    await usdc.write.mint([depositor.account.address, amount]);
    await usdc.write.approve([pool.address, amount], {
      account: depositor.account,
    });
    await pool.write.deposit([amount], { account: depositor.account });
  }

  describe("initialization", function () {
    it("sets owner and USDC token on initialize", async function () {
      const { pool, usdc, owner } = await setup();

      assertAddress(await pool.read.owner(), owner.account.address);
      assertAddress(await pool.read.usdcToken(), usdc.address);
    });

    it("reverts on double initialize", async function () {
      const { pool, usdc, owner } = await setup();

      await assertReverts(
        pool.write.initialize([usdc.address], { account: owner.account })
      );
    });
  });

  describe("deposit", function () {
    it("deposits USDC and increases pool balance", async function () {
      const { usdc, pool, depositor } = await setup();
      const amount = parseUnits("100", 6);

      await fundPool(usdc, pool, depositor, amount);

      assert.equal(await pool.read.poolBalance(), amount);
    });

    it("reverts on zero amount deposit", async function () {
      const { pool, depositor } = await setup();

      await assertReverts(
        pool.write.deposit([0n], { account: depositor.account })
      );
    });
  });

  describe("distribute", function () {
    it("distributes correct amounts to creators", async function () {
      const { usdc, pool, owner, creator1, creator2, creator3, depositor } =
        await setup();
      const depositAmount = parseUnits("100", 6);

      await fundPool(usdc, pool, depositor, depositAmount);

      const amounts = [
        parseUnits("50", 6),
        parseUnits("33.333333", 6),
        parseUnits("16.666667", 6),
      ];

      await pool.write.distribute(
        [
          [
            creator1.account.address,
            creator2.account.address,
            creator3.account.address,
          ],
          amounts,
        ],
        { account: owner.account }
      );

      assert.equal(
        await usdc.read.balanceOf([creator1.account.address]),
        amounts[0]
      );
      assert.equal(
        await usdc.read.balanceOf([creator2.account.address]),
        amounts[1]
      );
      assert.equal(
        await usdc.read.balanceOf([creator3.account.address]),
        amounts[2]
      );

      const totalDistributed = amounts.reduce((a, b) => a + b, 0n);
      assert.equal(
        await pool.read.poolBalance(),
        depositAmount - totalDistributed
      );
    });

    it("reverts if caller is not owner", async function () {
      const { usdc, pool, creator1, depositor } = await setup();
      await fundPool(usdc, pool, depositor, parseUnits("100", 6));

      await assertReverts(
        pool.write.distribute(
          [[creator1.account.address], [parseUnits("50", 6)]],
          { account: depositor.account }
        )
      );
    });

    it("reverts if amounts exceed pool balance", async function () {
      const { usdc, pool, owner, creator1, depositor } = await setup();
      await fundPool(usdc, pool, depositor, parseUnits("100", 6));

      await assertReverts(
        pool.write.distribute(
          [[creator1.account.address], [parseUnits("200", 6)]],
          { account: owner.account }
        )
      );
    });

    it("reverts if arrays have different lengths", async function () {
      const { usdc, pool, owner, creator1, creator2, depositor } =
        await setup();
      await fundPool(usdc, pool, depositor, parseUnits("100", 6));

      await assertReverts(
        pool.write.distribute(
          [
            [creator1.account.address, creator2.account.address],
            [parseUnits("50", 6)],
          ],
          { account: owner.account }
        )
      );
    });

    it("handles empty arrays (no-op)", async function () {
      const { usdc, pool, owner, depositor } = await setup();
      await fundPool(usdc, pool, depositor, parseUnits("100", 6));

      await pool.write.distribute([[], []], { account: owner.account });

      assert.equal(await pool.read.poolBalance(), parseUnits("100", 6));
    });

    it("skips zero-amount transfers", async function () {
      const { usdc, pool, owner, creator1, creator2, depositor } =
        await setup();
      await fundPool(usdc, pool, depositor, parseUnits("100", 6));

      await pool.write.distribute(
        [
          [creator1.account.address, creator2.account.address],
          [parseUnits("50", 6), 0n],
        ],
        { account: owner.account }
      );

      assert.equal(
        await usdc.read.balanceOf([creator1.account.address]),
        parseUnits("50", 6)
      );
      assert.equal(await usdc.read.balanceOf([creator2.account.address]), 0n);
      assert.equal(await pool.read.poolBalance(), parseUnits("50", 6));
    });
  });
});
