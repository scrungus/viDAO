import { NextResponse } from "next/server";
import {
  getCurrentPrivyUser,
  getPrivyUserEmail,
  getPrivyUserWallet,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttestationType } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const privyUser = await getCurrentPrivyUser();
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = getPrivyUserEmail(privyUser);
  const walletAddress = getPrivyUserWallet(privyUser);

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Parse optional body for WebAuthn credential info
  let webauthnCredentialId: string | undefined;
  let attestationType: AttestationType = AttestationType.SOFTWARE;

  try {
    const body = await request.json();
    webauthnCredentialId = body.webauthnCredentialId;
    if (body.attestationType === "HARDWARE") {
      attestationType = AttestationType.HARDWARE;
    }
  } catch {
    // Body is optional — user may register without WebAuthn initially
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      walletAddress: walletAddress ?? undefined,
      ...(webauthnCredentialId && { webauthnCredentialId }),
      ...(webauthnCredentialId && { webauthnAttestationType: attestationType }),
    },
    create: {
      email,
      walletAddress,
      webauthnCredentialId,
      webauthnAttestationType: attestationType,
    },
  });

  return NextResponse.json({ userId: user.id, role: user.role });
}
