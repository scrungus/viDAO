import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRegisteredUser } from "@/lib/withAuth";
import { AttestationType } from "@/generated/prisma/client";

export const POST = withRegisteredUser(async (_request, { user }) => {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      webauthnAttestationType: AttestationType.SOFTWARE,
      webauthnCredentialId: null,
    },
  });

  return NextResponse.json({ ok: true });
});
