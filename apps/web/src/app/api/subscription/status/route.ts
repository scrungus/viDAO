import { NextResponse } from "next/server";
import { withRegisteredUser } from "@/lib/withAuth";

export const POST = withRegisteredUser(async (_request, { user }) => {
  const now = new Date();
  const isActive = user.subscribedUntil ? user.subscribedUntil > now : false;

  return NextResponse.json({
    subscribed: isActive,
    subscribedUntil: user.subscribedUntil?.toISOString() ?? null,
    role: user.role,
  });
});
