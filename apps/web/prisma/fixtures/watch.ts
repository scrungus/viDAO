import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  createMonthlyWatchTotals,
  createWatchSessions,
} from "./factories.js";

type Video = { id: string };
type User = { id: string };

type MakeSessionsOpts = {
  count: number;
  weightedSecondsPerSession: number;
  sessionLengthMinutes?: number;
  spreadHoursBack?: number;
};

export async function makeWatchSessions(
  prisma: PrismaClient,
  viewer: User,
  videos: Video[],
  opts: MakeSessionsOpts,
) {
  const now = new Date();
  const length = opts.sessionLengthMinutes ?? 45;
  const spread = opts.spreadHoursBack ?? opts.count;
  const data = Array.from({ length: opts.count }, (_, i) => {
    const startedAt = new Date(
      now.getTime() - (spread - i) * 60 * 60 * 1000,
    );
    return {
      userId: viewer.id,
      videoId: videos[i % videos.length].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + length * 60 * 1000),
      weightedSeconds: opts.weightedSecondsPerSession,
    };
  });
  return createWatchSessions(prisma, data);
}

export function makeMonthlyTotal(
  prisma: PrismaClient,
  viewer: User,
  weightedHours: number,
  month?: string,
) {
  const now = new Date();
  const m =
    month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return createMonthlyWatchTotals(prisma, [
    { userId: viewer.id, month: m, weightedHours },
  ]);
}
