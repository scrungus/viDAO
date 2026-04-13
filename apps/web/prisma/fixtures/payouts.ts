import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  PayoutStatus,
  createCreatorPayouts,
  createPayoutPeriod,
} from "./factories.js";

type Creator = { id: string };

type CreatorShare = {
  creator: Creator;
  watchHours: number;
  sharePercentage: number;
  usdcAmount: number;
  txHash?: string;
};

export async function completedPayoutPeriod(
  prisma: PrismaClient,
  opts: {
    periodStart: Date;
    periodEnd: Date;
    totalPoolUsdc: number;
    shares: CreatorShare[];
  },
) {
  const period = await createPayoutPeriod(prisma, {
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    totalPoolUsdc: opts.totalPoolUsdc,
    status: PayoutStatus.DISTRIBUTED,
  });
  await createCreatorPayouts(
    prisma,
    opts.shares.map((s, i) => ({
      payoutPeriodId: period.id,
      creatorId: s.creator.id,
      watchHours: s.watchHours,
      sharePercentage: s.sharePercentage,
      usdcAmount: s.usdcAmount,
      txHash: s.txHash ?? `0xtest_tx_${i}`,
    })),
  );
  return period;
}

export function pendingPayoutPeriod(
  prisma: PrismaClient,
  opts: {
    periodStart: Date;
    periodEnd: Date;
    totalPoolUsdc: number;
  },
) {
  return createPayoutPeriod(prisma, {
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    totalPoolUsdc: opts.totalPoolUsdc,
    status: PayoutStatus.PENDING,
  });
}
