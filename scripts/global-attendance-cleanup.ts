import { prismaAuth } from "../lib/prisma";
import { logger } from "../lib/logger";

async function main() {
  logger.info("--- GLOBAL ATTENDANCE DATA CLEANUP (FOR PRODUCTION) ---");

  try {
    const recordsToFix = await prismaAuth.attendance.findMany({
      where: {
        status: "ABSENT",
        OR: [
          { notes: { contains: "Auto-Checkout: Lupa Absen Pulang" } },
          { notes: { contains: "Auto checkout by system (Mangkir)" } },
        ],
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    logger.info(
      `Initial scan found ${recordsToFix.length} potential records to check.`,
    );

    let fixedCount = 0;
    const defaultAlphaNote = "Tidak Masuk Kerja (Alpha) - Auto Generated";

    for (const record of recordsToFix) {
      const checkIn = record.checkIn;
      const hour = checkIn.getUTCHours();
      const minute = checkIn.getUTCMinutes();
      const second = checkIn.getUTCSeconds();

      const isSystemTime =
        (hour === 17 && minute === 0) || (hour === 0 && minute === 0);

      if (isSystemTime) {
        logger.info(
          `Fixing [${record.user.email}] Date: ${record.checkIn.toISOString()}`,
        );

        await prismaAuth.attendance.update({
          where: { id: record.id },
          data: {
            status: "ALPHA",
            checkOut: null,
            notes: defaultAlphaNote,
          },
        });
        fixedCount++;
      }
    }

    logger.info("--- CLEANUP COMPLETED ---");
    logger.info(`Total records fixed: ${fixedCount}`);
  } catch (error) {
    logger.error("Error during global cleanup:", error);
  }
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await (prismaAuth as any).$disconnect?.();
  });
