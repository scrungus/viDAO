import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  AttestationType,
  PayoutStatus,
  createCreator,
  createCreatorPayouts,
  createMonthlyWatchTotals,
  createPayoutPeriod,
  createVideo,
  createViewer,
  createWatchSessions,
  resetAllData,
} from "./factories.js";

export async function seed(prisma: PrismaClient): Promise<void> {
  await resetAllData(prisma);

  const alice = await createCreator(prisma, {
    email: "alice@example.com",
    walletAddress: "0xAlice0000000000000000000000000000000001",
    webauthnCredentialId: "cred-alice",
  });

  const bob = await createCreator(prisma, {
    email: "bob@example.com",
    walletAddress: "0xBob00000000000000000000000000000000000002",
    webauthnCredentialId: "cred-bob",
  });

  const carol = await createCreator(prisma, {
    email: "carol@example.com",
    walletAddress: "0xCarol000000000000000000000000000000000003",
    webauthnCredentialId: "cred-carol",
  });

  const subscribedHardware = await createViewer(prisma, {
    email: "viewer1@example.com",
    walletAddress: "0xViewer1000000000000000000000000000000004",
    webauthnCredentialId: "cred-viewer1",
    webauthnAttestationType: AttestationType.HARDWARE,
    subscribedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const subscribedSoftware = await createViewer(prisma, {
    email: "viewer2@example.com",
    walletAddress: "0xViewer2000000000000000000000000000000005",
    webauthnCredentialId: "cred-viewer2",
    webauthnAttestationType: AttestationType.SOFTWARE,
    subscribedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const expiredViewer = await createViewer(prisma, {
    email: "viewer3@example.com",
    walletAddress: "0xViewer3000000000000000000000000000000006",
    webauthnCredentialId: "cred-viewer3",
    webauthnAttestationType: AttestationType.HARDWARE,
    subscribedUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  });

  await createViewer(prisma, {
    email: "viewer4@example.com",
    walletAddress: "0xViewer4000000000000000000000000000000007",
  });

  await createViewer(prisma, {
    email: "viewer5@example.com",
    walletAddress: "0xViewer5000000000000000000000000000000008",
  });

  const videos = await Promise.all([
    createVideo(prisma, {
      creatorId: alice.id,
      title: "Introduction to Decentralized Streaming",
      description:
        "Learn how decentralized streaming platforms work and why they matter.",
      videoPath: "/videos/alice-intro.mp4",
      thumbnailUrl: "/thumbnails/alice-intro.jpg",
    }),
    createVideo(prisma, {
      creatorId: alice.id,
      title: "Building on Arbitrum",
      description: "A deep dive into building applications on Arbitrum L2.",
      videoPath: "/videos/alice-arbitrum.mp4",
      thumbnailUrl: "/thumbnails/alice-arbitrum.jpg",
    }),
    createVideo(prisma, {
      creatorId: alice.id,
      title: "WebAuthn Explained",
      description:
        "Understanding hardware attestation and what it means for security.",
      videoPath: "/videos/alice-webauthn.mp4",
      thumbnailUrl: "/thumbnails/alice-webauthn.jpg",
    }),
    createVideo(prisma, {
      creatorId: bob.id,
      title: "The Future of Creator Economics",
      description:
        "How transparent payout models change the game for creators.",
      videoPath: "/videos/bob-economics.mp4",
      thumbnailUrl: "/thumbnails/bob-economics.jpg",
    }),
    createVideo(prisma, {
      creatorId: bob.id,
      title: "Smart Contract Security Basics",
      description:
        "Essential security patterns for Solidity and Stylus contracts.",
      videoPath: "/videos/bob-security.mp4",
      thumbnailUrl: "/thumbnails/bob-security.jpg",
    }),
    createVideo(prisma, {
      creatorId: bob.id,
      title: "Layer 2 Scaling Deep Dive",
      description: "Comparing rollup architectures and their trade-offs.",
      videoPath: "/videos/bob-l2.mp4",
      thumbnailUrl: "/thumbnails/bob-l2.jpg",
    }),
    createVideo(prisma, {
      creatorId: carol.id,
      title: "Designing for Web3 UX",
      description: "Making crypto invisible to end users.",
      videoPath: "/videos/carol-ux.mp4",
      thumbnailUrl: "/thumbnails/carol-ux.jpg",
    }),
    createVideo(prisma, {
      creatorId: carol.id,
      title: "Privacy-Preserving Engagement Tracking",
      description:
        "How to track engagement without compromising user privacy.",
      videoPath: "/videos/carol-privacy.mp4",
      thumbnailUrl: "/thumbnails/carol-privacy.jpg",
    }),
  ]);

  const now = new Date();
  const sessionsData: {
    userId: string;
    videoId: string;
    startedAt: Date;
    lastHeartbeatAt: Date;
    weightedSeconds: number;
  }[] = [];

  for (let i = 0; i < 40; i++) {
    const videoIndex = i % videos.length;
    const startedAt = new Date(now.getTime() - (40 - i) * 60 * 60 * 1000);
    sessionsData.push({
      userId: subscribedHardware.id,
      videoId: videos[videoIndex].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + 45 * 60 * 1000),
      weightedSeconds: 2700,
    });
  }

  for (let i = 0; i < 20; i++) {
    const videoIndex = i % videos.length;
    const startedAt = new Date(
      now.getTime() - (20 - i) * 2 * 60 * 60 * 1000,
    );
    sessionsData.push({
      userId: subscribedSoftware.id,
      videoId: videos[videoIndex].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + 30 * 60 * 1000),
      weightedSeconds: 0,
    });
  }

  for (let i = 0; i < 15; i++) {
    const videoIndex = i % videos.length;
    const startedAt = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000 + i * 60 * 60 * 1000,
    );
    sessionsData.push({
      userId: expiredViewer.id,
      videoId: videos[videoIndex].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + 20 * 60 * 1000),
      weightedSeconds: 1200,
    });
  }

  await createWatchSessions(prisma, sessionsData);

  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;

  await createMonthlyWatchTotals(prisma, [
    { userId: subscribedHardware.id, month: currentMonth, weightedHours: 48.5 },
    { userId: subscribedSoftware.id, month: currentMonth, weightedHours: 0 },
    { userId: expiredViewer.id, month: currentMonth, weightedHours: 5.0 },
  ]);

  const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const payoutPeriod = await createPayoutPeriod(prisma, {
    periodStart: lastWeekStart,
    periodEnd: lastWeekEnd,
    totalPoolUsdc: 100.0,
    status: PayoutStatus.DISTRIBUTED,
  });

  await createCreatorPayouts(prisma, [
    {
      payoutPeriodId: payoutPeriod.id,
      creatorId: alice.id,
      watchHours: 15.0,
      sharePercentage: 0.5,
      usdcAmount: 50.0,
      txHash: "0xfake_tx_alice_001",
    },
    {
      payoutPeriodId: payoutPeriod.id,
      creatorId: bob.id,
      watchHours: 10.0,
      sharePercentage: 0.333333,
      usdcAmount: 33.33,
      txHash: "0xfake_tx_bob_001",
    },
    {
      payoutPeriodId: payoutPeriod.id,
      creatorId: carol.id,
      watchHours: 5.0,
      sharePercentage: 0.166667,
      usdcAmount: 16.67,
      txHash: "0xfake_tx_carol_001",
    },
  ]);

  console.log("Seed complete:");
  console.log("  - 3 creators, 5 viewers");
  console.log("  - 8 videos");
  console.log(`  - ${sessionsData.length} watch sessions`);
  console.log("  - Monthly watch totals for 3 viewers");
  console.log("  - 1 completed payout period with 3 creator payouts");
}
