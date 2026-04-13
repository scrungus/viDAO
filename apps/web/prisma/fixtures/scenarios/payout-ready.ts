// payout-ready: three creators with hardware-attested viewers and deterministic
// monthly watch totals so test_payout_cron.py can assert exact share math.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createVideo, resetAllData } from "../factories.js";
import {
  aliceCreator,
  bobCreator,
  carolCreator,
  subscribedHardwareViewer,
} from "../users.js";
import { makeWatchSessions, makeMonthlyTotal } from "../watch.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await resetAllData(prisma);
  const alice = await aliceCreator(prisma);
  const bob = await bobCreator(prisma);
  const carol = await carolCreator(prisma);
  const viewer = await subscribedHardwareViewer(prisma);

  const aliceVideo = await createVideo(prisma, {
    creatorId: alice.id,
    title: "Alice video",
    description: "",
    videoPath: "/videos/alice.mp4",
    thumbnailUrl: "/thumbnails/alice.jpg",
  });
  const bobVideo = await createVideo(prisma, {
    creatorId: bob.id,
    title: "Bob video",
    description: "",
    videoPath: "/videos/bob.mp4",
    thumbnailUrl: "/thumbnails/bob.jpg",
  });
  const carolVideo = await createVideo(prisma, {
    creatorId: carol.id,
    title: "Carol video",
    description: "",
    videoPath: "/videos/carol.mp4",
    thumbnailUrl: "/thumbnails/carol.jpg",
  });

  // 30 / 15 / 5 hours -> 60/30/10% share. 3600 weighted seconds = 1 hour.
  await makeWatchSessions(prisma, viewer, [aliceVideo], {
    count: 30,
    weightedSecondsPerSession: 3600,
  });
  await makeWatchSessions(prisma, viewer, [bobVideo], {
    count: 15,
    weightedSecondsPerSession: 3600,
  });
  await makeWatchSessions(prisma, viewer, [carolVideo], {
    count: 5,
    weightedSecondsPerSession: 3600,
  });

  await makeMonthlyTotal(prisma, viewer, 50.0);

  console.log(
    JSON.stringify({
      creators: {
        alice: { id: alice.id, walletAddress: alice.walletAddress },
        bob: { id: bob.id, walletAddress: bob.walletAddress },
        carol: { id: carol.id, walletAddress: carol.walletAddress },
      },
      viewer: { id: viewer.id },
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
