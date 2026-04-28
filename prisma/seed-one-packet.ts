import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

async function main() {
  const count = await prisma.hargaPaket.count();
  if (count > 0) {
    logger.info("HargaPaket already exists, skipping seed.");
    return;
  }

  // Need a ProfilePPP first?
  let profile = await prisma.profilePPP.findFirst();
  if (!profile) {
    profile = await prisma.profilePPP.create({
      data: {
        id: randomUUID(),
        name: "default",
        localAddress: "192.168.1.1",
        remoteAddress: "pool-default",
        dnsServer: "8.8.8.8",
        status: "AKTIF",
        updatedAt: new Date(),
      },
    });
    logger.info("Created default ProfilePPP");
  }

  await prisma.hargaPaket.create({
    data: {
      id: randomUUID(),
      name: "Default Package",
      harga: 100000,
      durasi: 30,
      durasiUnit: "HARI",
      profilePPPId: profile.id,
      status: "AKTIF",
      description: "Auto-generated default package for sync",
      updatedAt: new Date(),
    },
  });

  logger.info("Created Default Package");
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
