import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AttestationType, createCreator, createViewer } from "./factories.js";

export function aliceCreator(prisma: PrismaClient) {
  return createCreator(prisma, {
    email: "alice@example.com",
    walletAddress: "0xAlice0000000000000000000000000000000001",
    webauthnCredentialId: "cred-alice",
  });
}

export function bobCreator(prisma: PrismaClient) {
  return createCreator(prisma, {
    email: "bob@example.com",
    walletAddress: "0xBob00000000000000000000000000000000000002",
    webauthnCredentialId: "cred-bob",
  });
}

export function carolCreator(prisma: PrismaClient) {
  return createCreator(prisma, {
    email: "carol@example.com",
    walletAddress: "0xCarol000000000000000000000000000000000003",
    webauthnCredentialId: "cred-carol",
  });
}

type SubscribedViewerOpts = { daysRemaining?: number };

export function subscribedHardwareViewer(
  prisma: PrismaClient,
  opts: SubscribedViewerOpts = {},
) {
  return createViewer(prisma, {
    email: "viewer-hw@test.local",
    walletAddress: "0xViewerHW00000000000000000000000000000004",
    webauthnCredentialId: "cred-viewer-hw",
    webauthnAttestationType: AttestationType.HARDWARE,
    subscribedUntil: new Date(
      Date.now() + (opts.daysRemaining ?? 30) * 24 * 60 * 60 * 1000,
    ),
  });
}

export function subscribedSoftwareViewer(
  prisma: PrismaClient,
  opts: SubscribedViewerOpts = {},
) {
  return createViewer(prisma, {
    email: "viewer-sw@test.local",
    walletAddress: "0xViewerSW00000000000000000000000000000005",
    webauthnCredentialId: "cred-viewer-sw",
    webauthnAttestationType: AttestationType.SOFTWARE,
    subscribedUntil: new Date(
      Date.now() + (opts.daysRemaining ?? 30) * 24 * 60 * 60 * 1000,
    ),
  });
}

export function expiredHardwareViewer(prisma: PrismaClient) {
  return createViewer(prisma, {
    email: "viewer-expired@test.local",
    walletAddress: "0xViewerEXP0000000000000000000000000000006",
    webauthnCredentialId: "cred-viewer-expired",
    webauthnAttestationType: AttestationType.HARDWARE,
    subscribedUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  });
}

export function unattestedViewer(
  prisma: PrismaClient,
  index: "A" | "B" = "A",
) {
  const suffix = index === "A" ? "A" : "B";
  return createViewer(prisma, {
    email: `viewer-unattested-${suffix.toLowerCase()}@test.local`,
    walletAddress: `0xViewerUN${suffix}000000000000000000000000000000007`,
  });
}
