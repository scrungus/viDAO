import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttestationType } from "@/generated/prisma/client";

const MAX_HEARTBEAT_GAP_SECONDS = 45;
const MONTHLY_CAP_HOURS = 50;

export async function POST(request: Request) {
  // Always return 200 — silent failures per spec
  const ok = () => NextResponse.json({ ok: true });

  const user = await getCurrentUser();
  if (!user) return ok();

  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = body.sessionId;
  } catch {
    return ok();
  }

  if (!sessionId) return ok();

  // Verify session belongs to this user
  const session = await prisma.watchSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.userId !== user.id) return ok();

  // Only count time for HARDWARE attestation
  if (user.webauthnAttestationType !== AttestationType.HARDWARE) return ok();

  // Check subscription is active
  if (!user.subscribedUntil || user.subscribedUntil < new Date()) return ok();

  // Calculate time since last heartbeat
  const now = new Date();
  const lastBeat = session.lastHeartbeatAt ?? session.startedAt;
  const gapSeconds = (now.getTime() - lastBeat.getTime()) / 1000;

  // Gap too long (pause, blur, tab hidden, network hiccup): don't credit this
  // interval, but re-anchor lastHeartbeatAt so subsequent beats resume normally.
  if (gapSeconds > MAX_HEARTBEAT_GAP_SECONDS) {
    await prisma.watchSession.update({
      where: { id: sessionId },
      data: { lastHeartbeatAt: now },
    });
    return ok();
  }

  const incrementSeconds = Math.min(
    Math.floor(gapSeconds),
    MAX_HEARTBEAT_GAP_SECONDS,
  );

  // Check monthly cap
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlyTotal = await prisma.monthlyWatchTotal.upsert({
    where: { userId_month: { userId: user.id, month } },
    create: { userId: user.id, month, weightedHours: 0 },
    update: {},
  });

  const currentHours = Number(monthlyTotal.weightedHours);
  if (currentHours >= MONTHLY_CAP_HOURS) return ok();

  // Calculate how many seconds we can actually add before hitting the cap
  const remainingHours = MONTHLY_CAP_HOURS - currentHours;
  const remainingSeconds = remainingHours * 3600;
  const actualIncrement = Math.min(incrementSeconds, Math.floor(remainingSeconds));

  if (actualIncrement <= 0) return ok();

  const hoursIncrement = actualIncrement / 3600;

  // Update session and monthly total in a transaction
  await prisma.$transaction([
    prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        lastHeartbeatAt: now,
        weightedSeconds: { increment: actualIncrement },
      },
    }),
    prisma.monthlyWatchTotal.update({
      where: { userId_month: { userId: user.id, month } },
      data: {
        weightedHours: { increment: hoursIncrement },
      },
    }),
  ]);

  return ok();
}
