// near-monthly-cap: one hardware viewer at 49.99 weighted hours in the
// current month. Drives test_heartbeat.py::test_monthly_cap_enforcement.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createVideo, resetAllData } from "../factories.js";
import { aliceCreator, subscribedHardwareViewer } from "../users.js";
import { makeMonthlyTotal } from "../watch.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await resetAllData(prisma);
  const alice = await aliceCreator(prisma);
  const viewer = await subscribedHardwareViewer(prisma);
  const video = await createVideo(prisma, {
    creatorId: alice.id,
    title: "Cap fixture video",
    description: "",
    videoPath: "/videos/cap.mp4",
    thumbnailUrl: "/thumbnails/cap.jpg",
  });
  await makeMonthlyTotal(prisma, viewer, 49.99);
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
      viewer: { id: viewer.id },
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
