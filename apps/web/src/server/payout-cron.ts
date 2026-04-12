import { prisma } from "@/lib/prisma";
import {
  PAYOUT_POOL_ABI,
  PAYOUT_POOL_ADDRESS,
  publicClient,
  getWalletClient,
} from "@/lib/contract";
import type { Address } from "viem";

type CronResult = {
  skipped: boolean;
  reason?: string;
  payoutPeriodId?: string;
  totalPoolUsdc?: string;
  creatorPayouts?: {
    creatorId: string;
    email: string;
    watchHours: string;
    sharePercentage: string;
    usdcAmount: string;
  }[];
  txHash?: string;
};

/**
 * Run the weekly payout distribution.
 *
 * 1. Aggregate weighted watch seconds per creator for the period (last 7 days).
 * 2. Compute each creator's share of the on-chain pool balance.
 * 3. Call PayoutPool.distribute() if a wallet client is configured.
 * 4. Record PayoutPeriod + CreatorPayout rows in the DB.
 */
export async function runPayoutCron(
  periodStart: Date = defaultPeriodStart(),
  periodEnd: Date = new Date(),
): Promise<CronResult> {
  // Aggregate weighted seconds per creator from WatchSession joined with Video
  const sessions = await prisma.watchSession.findMany({
    where: {
      startedAt: { gte: periodStart, lt: periodEnd },
      weightedSeconds: { gt: 0 },
    },
    include: { video: { select: { creatorId: true } } },
  });

  const creatorSeconds = new Map<string, bigint>();
  for (const s of sessions) {
    const prev = creatorSeconds.get(s.video.creatorId) ?? 0n;
    creatorSeconds.set(s.video.creatorId, prev + BigInt(s.weightedSeconds));
  }

  if (creatorSeconds.size === 0) {
    return { skipped: true, reason: "No watch hours in period" };
  }

  // Compute total seconds
  let totalSeconds = 0n;
  for (const s of creatorSeconds.values()) totalSeconds += s;
  if (totalSeconds === 0n) {
    return { skipped: true, reason: "Zero watch hours" };
  }

  // Load pool balance from chain (or 0 if contract not deployed)
  let poolBalance = 0n;
  if (PAYOUT_POOL_ADDRESS) {
    try {
      poolBalance = (await publicClient.readContract({
        address: PAYOUT_POOL_ADDRESS,
        abi: PAYOUT_POOL_ABI,
        functionName: "pool_balance",
      })) as bigint;
    } catch (err) {
      console.warn("[payout-cron] Could not read pool_balance, using 0:", err);
    }
  }

  if (poolBalance === 0n) {
    return { skipped: true, reason: "Pool is empty" };
  }

  // Load creators and their wallet addresses
  const creators = await prisma.user.findMany({
    where: { id: { in: [...creatorSeconds.keys()] } },
    select: { id: true, email: true, walletAddress: true },
  });

  // Calculate shares — skip creators without a wallet address
  const payouts: {
    creatorId: string;
    email: string;
    walletAddress: Address;
    watchSeconds: bigint;
    usdcAmount: bigint;
  }[] = [];
  let distributedTotal = 0n;

  for (const c of creators) {
    if (!c.walletAddress) continue;
    const seconds = creatorSeconds.get(c.id) ?? 0n;
    if (seconds === 0n) continue;
    // usdcAmount = poolBalance * seconds / totalSeconds
    const amount = (poolBalance * seconds) / totalSeconds;
    if (amount === 0n) continue;
    payouts.push({
      creatorId: c.id,
      email: c.email,
      walletAddress: c.walletAddress as Address,
      watchSeconds: seconds,
      usdcAmount: amount,
    });
    distributedTotal += amount;
  }

  if (payouts.length === 0) {
    return { skipped: true, reason: "No eligible creators with wallets" };
  }

  // Call the contract if deployer key is available
  let txHash: string | undefined;
  if (PAYOUT_POOL_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) {
    try {
      const wallet = getWalletClient();
      const creatorAddrs = payouts.map((p) => p.walletAddress);
      const amounts = payouts.map((p) => p.usdcAmount);
      txHash = await wallet.writeContract({
        address: PAYOUT_POOL_ADDRESS,
        abi: PAYOUT_POOL_ABI,
        functionName: "distribute",
        args: [creatorAddrs, amounts],
      });
      console.log("[payout-cron] distribute tx:", txHash);
    } catch (err) {
      console.error("[payout-cron] Contract call failed:", err);
      // Continue anyway — record the intended payout in the DB
    }
  } else {
    console.log(
      "[payout-cron] Skipping on-chain distribute (contract or key missing)",
    );
  }

  // Persist the period + payouts
  const period = await prisma.payoutPeriod.create({
    data: {
      periodStart,
      periodEnd,
      totalPoolUsdc: formatUsdc(distributedTotal),
      status: txHash ? "DISTRIBUTED" : "PENDING",
      creatorPayouts: {
        create: payouts.map((p) => ({
          creatorId: p.creatorId,
          watchHours: formatHours(p.watchSeconds),
          sharePercentage: formatPercent(p.usdcAmount, distributedTotal),
          usdcAmount: formatUsdc(p.usdcAmount),
          txHash: txHash ?? null,
        })),
      },
    },
    include: { creatorPayouts: { include: { creator: true } } },
  });

  return {
    skipped: false,
    payoutPeriodId: period.id,
    totalPoolUsdc: period.totalPoolUsdc.toString(),
    creatorPayouts: period.creatorPayouts.map((p) => ({
      creatorId: p.creatorId,
      email: p.creator.email,
      watchHours: p.watchHours.toString(),
      sharePercentage: p.sharePercentage.toString(),
      usdcAmount: p.usdcAmount.toString(),
    })),
    txHash,
  };
}

function defaultPeriodStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

/** Format USDC (6 decimals) wei-ish bigint to a Decimal string */
function formatUsdc(amount: bigint): string {
  const divisor = 1_000_000n;
  const whole = amount / divisor;
  const frac = amount % divisor;
  return `${whole}.${frac.toString().padStart(6, "0")}`;
}

/** Seconds -> hours string with 4 decimals */
function formatHours(seconds: bigint): string {
  const hoursTimes10k = (seconds * 10000n) / 3600n;
  const whole = hoursTimes10k / 10000n;
  const frac = hoursTimes10k % 10000n;
  return `${whole}.${frac.toString().padStart(4, "0")}`;
}

/** Percentage string (0-100 with 6 decimals) */
function formatPercent(part: bigint, total: bigint): string {
  if (total === 0n) return "0.000000";
  const bps = (part * 100_000_000n) / total; // basis points * 10^6
  const whole = bps / 1_000_000n;
  const frac = bps % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0")}`;
}
