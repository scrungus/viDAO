import "dotenv/config";
import { PrismaClient, UserRole, AttestationType, PayoutStatus } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
  await prisma.creatorPayout.deleteMany();
  await prisma.payoutPeriod.deleteMany();
  await prisma.monthlyWatchTotal.deleteMany();
  await prisma.watchSession.deleteMany();
  await prisma.video.deleteMany();
  await prisma.user.deleteMany();

  // --- Creators ---
  const alice = await prisma.user.create({
    data: {
      email: "alice@example.com",
      walletAddress: "0xAlice0000000000000000000000000000000001",
      webauthnCredentialId: "cred-alice",
      webauthnAttestationType: AttestationType.HARDWARE,
      role: UserRole.CREATOR,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@example.com",
      walletAddress: "0xBob00000000000000000000000000000000000002",
      webauthnCredentialId: "cred-bob",
      webauthnAttestationType: AttestationType.HARDWARE,
      role: UserRole.CREATOR,
    },
  });

  const carol = await prisma.user.create({
    data: {
      email: "carol@example.com",
      walletAddress: "0xCarol000000000000000000000000000000000003",
      webauthnCredentialId: "cred-carol",
      webauthnAttestationType: AttestationType.HARDWARE,
      role: UserRole.CREATOR,
    },
  });

  // --- Viewers ---
  const subscribedHardware = await prisma.user.create({
    data: {
      email: "viewer1@example.com",
      walletAddress: "0xViewer1000000000000000000000000000000004",
      webauthnCredentialId: "cred-viewer1",
      webauthnAttestationType: AttestationType.HARDWARE,
      subscribedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      role: UserRole.VIEWER,
    },
  });

  const subscribedSoftware = await prisma.user.create({
    data: {
      email: "viewer2@example.com",
      walletAddress: "0xViewer2000000000000000000000000000000005",
      webauthnCredentialId: "cred-viewer2",
      webauthnAttestationType: AttestationType.SOFTWARE,
      subscribedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      role: UserRole.VIEWER,
    },
  });

  const expiredViewer = await prisma.user.create({
    data: {
      email: "viewer3@example.com",
      walletAddress: "0xViewer3000000000000000000000000000000006",
      webauthnCredentialId: "cred-viewer3",
      webauthnAttestationType: AttestationType.HARDWARE,
      subscribedUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // expired 7 days ago
      role: UserRole.VIEWER,
    },
  });

  await prisma.user.create({
    data: {
      email: "viewer4@example.com",
      walletAddress: "0xViewer4000000000000000000000000000000007",
      role: UserRole.VIEWER,
    },
  });

  await prisma.user.create({
    data: {
      email: "viewer5@example.com",
      walletAddress: "0xViewer5000000000000000000000000000000008",
      role: UserRole.VIEWER,
    },
  });

  // --- Videos ---
  const videos = await Promise.all([
    prisma.video.create({
      data: {
        creatorId: alice.id,
        title: "Introduction to Decentralized Streaming",
        description: "Learn how decentralized streaming platforms work and why they matter.",
        videoPath: "/videos/alice-intro.mp4",
        thumbnailUrl: "/thumbnails/alice-intro.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: alice.id,
        title: "Building on Arbitrum",
        description: "A deep dive into building applications on Arbitrum L2.",
        videoPath: "/videos/alice-arbitrum.mp4",
        thumbnailUrl: "/thumbnails/alice-arbitrum.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: alice.id,
        title: "WebAuthn Explained",
        description: "Understanding hardware attestation and what it means for security.",
        videoPath: "/videos/alice-webauthn.mp4",
        thumbnailUrl: "/thumbnails/alice-webauthn.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: bob.id,
        title: "The Future of Creator Economics",
        description: "How transparent payout models change the game for creators.",
        videoPath: "/videos/bob-economics.mp4",
        thumbnailUrl: "/thumbnails/bob-economics.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: bob.id,
        title: "Smart Contract Security Basics",
        description: "Essential security patterns for Solidity and Stylus contracts.",
        videoPath: "/videos/bob-security.mp4",
        thumbnailUrl: "/thumbnails/bob-security.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: bob.id,
        title: "Layer 2 Scaling Deep Dive",
        description: "Comparing rollup architectures and their trade-offs.",
        videoPath: "/videos/bob-l2.mp4",
        thumbnailUrl: "/thumbnails/bob-l2.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: carol.id,
        title: "Designing for Web3 UX",
        description: "Making crypto invisible to end users.",
        videoPath: "/videos/carol-ux.mp4",
        thumbnailUrl: "/thumbnails/carol-ux.jpg",
      },
    }),
    prisma.video.create({
      data: {
        creatorId: carol.id,
        title: "Privacy-Preserving Engagement Tracking",
        description: "How to track engagement without compromising user privacy.",
        videoPath: "/videos/carol-privacy.mp4",
        thumbnailUrl: "/thumbnails/carol-privacy.jpg",
      },
    }),
  ]);

  // --- Watch Sessions (spread across viewers and videos) ---
  const now = new Date();
  const sessionsData = [];

  // subscribedHardware viewer: heavy watcher — near the 50hr cap
  for (let i = 0; i < 40; i++) {
    const videoIndex = i % videos.length;
    const startedAt = new Date(now.getTime() - (40 - i) * 60 * 60 * 1000);
    sessionsData.push({
      userId: subscribedHardware.id,
      videoId: videos[videoIndex].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + 45 * 60 * 1000), // 45 min session
      weightedSeconds: 2700, // 45 min
    });
  }

  // subscribedSoftware viewer: watches but doesn't count toward pool
  for (let i = 0; i < 20; i++) {
    const videoIndex = i % videos.length;
    const startedAt = new Date(now.getTime() - (20 - i) * 2 * 60 * 60 * 1000);
    sessionsData.push({
      userId: subscribedSoftware.id,
      videoId: videos[videoIndex].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + 30 * 60 * 1000),
      weightedSeconds: 0, // software attestation — doesn't count
    });
  }

  // expiredViewer: some old sessions
  for (let i = 0; i < 15; i++) {
    const videoIndex = i % videos.length;
    const startedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + i * 60 * 60 * 1000);
    sessionsData.push({
      userId: expiredViewer.id,
      videoId: videos[videoIndex].id,
      startedAt,
      lastHeartbeatAt: new Date(startedAt.getTime() + 20 * 60 * 1000),
      weightedSeconds: 1200, // 20 min
    });
  }

  await prisma.watchSession.createMany({ data: sessionsData });

  // --- Monthly Watch Totals ---
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.monthlyWatchTotal.createMany({
    data: [
      { userId: subscribedHardware.id, month: currentMonth, weightedHours: 48.5 }, // near cap
      { userId: subscribedSoftware.id, month: currentMonth, weightedHours: 0 },    // software — 0
      { userId: expiredViewer.id, month: currentMonth, weightedHours: 5.0 },
    ],
  });

  // --- Completed Payout Period (last week) ---
  const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const payoutPeriod = await prisma.payoutPeriod.create({
    data: {
      periodStart: lastWeekStart,
      periodEnd: lastWeekEnd,
      totalPoolUsdc: 100.0,
      status: PayoutStatus.DISTRIBUTED,
    },
  });

  // Alice: 15hrs (50%), Bob: 10hrs (33.3%), Carol: 5hrs (16.7%)
  await prisma.creatorPayout.createMany({
    data: [
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
    ],
  });

  console.log("Seed complete:");
  console.log("  - 3 creators, 5 viewers");
  console.log("  - 8 videos");
  console.log(`  - ${sessionsData.length} watch sessions`);
  console.log("  - Monthly watch totals for 3 viewers");
  console.log("  - 1 completed payout period with 3 creator payouts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
