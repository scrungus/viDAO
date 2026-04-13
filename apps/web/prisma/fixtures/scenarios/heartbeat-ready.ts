// heartbeat-ready: one HARDWARE-attested viewer with an active subscription,
// one creator with one video, one open WatchSession at t=0. Used by
// test_heartbeat.py to exercise the heartbeat endpoint end to end.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createVideo, resetAllData } from "../factories.js";
import { aliceCreator, subscribedHardwareViewer } from "../users.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await resetAllData(prisma);
  const alice = await aliceCreator(prisma);
  const viewer = await subscribedHardwareViewer(prisma);
  const video = await createVideo(prisma, {
    creatorId: alice.id,
    title: "Heartbeat test video",
    description: "Fixture",
    videoPath: "/videos/fixture.mp4",
    thumbnailUrl: "/thumbnails/fixture.jpg",
  });
  const session = await prisma.watchSession.create({
    data: {
      userId: viewer.id,
      videoId: video.id,
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
      weightedSeconds: 0,
    },
  });
  console.log(
    JSON.stringify({
      creator: { id: alice.id, email: alice.email },
      viewer: { id: viewer.id, email: viewer.email },
      video: { id: video.id },
      session: { id: session.id },
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
