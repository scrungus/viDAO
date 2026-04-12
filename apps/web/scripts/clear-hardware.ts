import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: tsx clear-hardware.ts <email>");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const updated = await prisma.user.update({
    where: { email },
    data: {
      webauthnAttestationType: "SOFTWARE",
      webauthnCredentialId: null,
    },
    select: {
      id: true,
      email: true,
      webauthnAttestationType: true,
      webauthnCredentialId: true,
    },
  });
  console.log(JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
