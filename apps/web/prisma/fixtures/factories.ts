import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  AttestationType,
  PayoutStatus,
  UserRole,
} from "../../src/generated/prisma/client.js";

export { AttestationType, PayoutStatus, UserRole };

export async function resetAllData(prisma: PrismaClient): Promise<void> {
  await prisma.creatorPayout.deleteMany();
  await prisma.payoutPeriod.deleteMany();
  await prisma.monthlyWatchTotal.deleteMany();
  await prisma.watchSession.deleteMany();
  await prisma.video.deleteMany();
  await prisma.user.deleteMany();
}

type CreatorInput = {
  email: string;
  walletAddress: string;
  webauthnCredentialId: string;
  webauthnAttestationType?: AttestationType;
};

export function createCreator(prisma: PrismaClient, data: CreatorInput) {
  return prisma.user.create({
    data: {
      email: data.email,
      walletAddress: data.walletAddress,
      webauthnCredentialId: data.webauthnCredentialId,
      webauthnAttestationType:
        data.webauthnAttestationType ?? AttestationType.HARDWARE,
      role: UserRole.CREATOR,
    },
  });
}

type ViewerInput = {
  email: string;
  walletAddress: string;
  webauthnCredentialId?: string;
  webauthnAttestationType?: AttestationType;
  subscribedUntil?: Date;
};

export function createViewer(prisma: PrismaClient, data: ViewerInput) {
  return prisma.user.create({
    data: {
      email: data.email,
      walletAddress: data.walletAddress,
      webauthnCredentialId: data.webauthnCredentialId,
      webauthnAttestationType: data.webauthnAttestationType,
      subscribedUntil: data.subscribedUntil,
      role: UserRole.VIEWER,
    },
  });
}

type VideoInput = {
  creatorId: string;
  title: string;
  description: string;
  videoPath: string;
  thumbnailUrl: string;
};

export function createVideo(prisma: PrismaClient, data: VideoInput) {
  return prisma.video.create({ data });
}

type WatchSessionInput = {
  userId: string;
  videoId: string;
  startedAt: Date;
  lastHeartbeatAt: Date;
  weightedSeconds: number;
};

export function createWatchSessions(
  prisma: PrismaClient,
  data: WatchSessionInput[],
) {
  return prisma.watchSession.createMany({ data });
}

type MonthlyWatchTotalInput = {
  userId: string;
  month: string;
  weightedHours: number;
};

export function createMonthlyWatchTotals(
  prisma: PrismaClient,
  data: MonthlyWatchTotalInput[],
) {
  return prisma.monthlyWatchTotal.createMany({ data });
}

type PayoutPeriodInput = {
  periodStart: Date;
  periodEnd: Date;
  totalPoolUsdc: number;
  status: PayoutStatus;
};

export function createPayoutPeriod(
  prisma: PrismaClient,
  data: PayoutPeriodInput,
) {
  return prisma.payoutPeriod.create({ data });
}

type CreatorPayoutInput = {
  payoutPeriodId: string;
  creatorId: string;
  watchHours: number;
  sharePercentage: number;
  usdcAmount: number;
  txHash: string;
};

export function createCreatorPayouts(
  prisma: PrismaClient,
  data: CreatorPayoutInput[],
) {
  return prisma.creatorPayout.createMany({ data });
}
