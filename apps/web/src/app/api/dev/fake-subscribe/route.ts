import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_DEV_MOCK_TRANSAK !== "true"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const base =
    user.subscribedUntil && user.subscribedUntil > now
      ? user.subscribedUntil
      : now;
  const subscribedUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { subscribedUntil },
  });

  return NextResponse.json({ subscribedUntil });
}
