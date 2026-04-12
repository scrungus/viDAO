import { NextResponse } from "next/server";
import { runPayoutCron } from "@/server/payout-cron";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPayoutCron();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/payout] failed:", err);
    return NextResponse.json(
      { error: "Payout cron failed", detail: String(err) },
      { status: 500 },
    );
  }
}
