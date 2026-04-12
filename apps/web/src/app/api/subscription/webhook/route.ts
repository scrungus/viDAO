import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/subscription/webhook
 *
 * Transak sends order events as JWT-encrypted payloads.
 * On ORDER_COMPLETED, we activate the user's subscription for 30 days.
 *
 * The on-chain deposit to PayoutPool happens separately — Transak sends
 * USDC directly to the pool wallet, and we track subscription status in
 * the DB for gating watch time.
 */
export async function POST(request: Request) {
  const accessToken = process.env.TRANSAK_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[webhook] TRANSAK_ACCESS_TOKEN not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Decrypt the JWT payload
    const decoded = jwt.verify(data, accessToken) as Record<string, unknown>;
    const webhookData = (decoded.webhookData ?? decoded) as Record<string, unknown>;
    const eventId = (decoded.eventID ?? body.eventID) as string;

    console.log("[webhook] Transak event:", eventId, "order:", webhookData.id);

    if (eventId !== "ORDER_COMPLETED") {
      // Acknowledge non-completion events without action
      return NextResponse.json({ ok: true });
    }

    // Extract wallet address from the order
    const walletAddress = webhookData.walletAddress as string | undefined;
    if (!walletAddress) {
      console.log("[webhook] ORDER_COMPLETED but no walletAddress in payload");
      return NextResponse.json({ ok: true });
    }

    // Find user by wallet address and activate subscription
    const user = await prisma.user.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: "insensitive" } },
    });

    if (!user) {
      console.log("[webhook] No user found for wallet:", walletAddress);
      return NextResponse.json({ ok: true });
    }

    const subscribedUntil = new Date();
    subscribedUntil.setDate(subscribedUntil.getDate() + 30);

    await prisma.user.update({
      where: { id: user.id },
      data: { subscribedUntil },
    });

    console.log(
      "[webhook] Subscription activated for",
      user.email,
      "until",
      subscribedUntil.toISOString(),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Error processing Transak webhook:", err);
    // Always return 200 to prevent Transak retries on our errors
    return NextResponse.json({ ok: true });
  }
}
