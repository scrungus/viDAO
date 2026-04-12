import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRegisteredUser } from "@/lib/withAuth";

export const POST = withRegisteredUser(async (_request, { user }) => {
  await prisma.user.update({
    where: { id: user.id },
    data: { subscribedUntil: null },
  });

  return NextResponse.json({ ok: true });
});
