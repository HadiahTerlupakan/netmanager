/**
 * Add GENERAL_TIMEZONE setting to database
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";
import "dotenv/config";
import { logger } from "../lib/logger";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // 1. Timezone setting
  const existingTimezone = await prisma.settings.findFirst({
    where: { key: "GENERAL_TIMEZONE" },
  });

  if (existingTimezone) {
    await prisma.settings.update({
      where: { id: existingTimezone.id },
      data: { value: "Asia/Jakarta" },
    });
    logger.info("✅ GENERAL_TIMEZONE setting updated");
  } else {
    await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: "GENERAL_TIMEZONE",
        value: "Asia/Jakarta",
        description: "Timezone aplikasi (IANA format)",
        updatedAt: new Date(),
      },
    });
    logger.info("✅ GENERAL_TIMEZONE setting created");
  }

  // 2. Attendance tolerance setting
  const existingTolerance = await prisma.settings.findFirst({
    where: { key: "GENERAL_ATTENDANCE_TOLERANCE" },
  });

  if (existingTolerance) {
    await prisma.settings.update({
      where: { id: existingTolerance.id },
      data: { value: "0" },
    });
    logger.info("✅ GENERAL_ATTENDANCE_TOLERANCE setting updated");
  } else {
    await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: "GENERAL_ATTENDANCE_TOLERANCE",
        value: "0",
        description: "Toleransi keterlambatan (menit)",
        updatedAt: new Date(),
      },
    });
    logger.info("✅ GENERAL_ATTENDANCE_TOLERANCE setting created");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  logger.error("Error:", e);
  process.exit(1);
});
