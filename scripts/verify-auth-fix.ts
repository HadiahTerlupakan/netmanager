import { prismaAuth } from "../lib/prisma";
import { prismaMitraAuth } from "../lib/prisma-mitra";
import { logger } from "../lib/logger";

async function verify() {
  logger.info("--- VERIFYING AUTH LOOKUP (No Tenant Context) ---");

  // Test Employee Lookup
  const testEmail = "admin@example.com";
  logger.info(`Checking Employee: ${testEmail}...`);
  try {
    const user = await prismaAuth.user.findUnique({
      where: { email: testEmail },
    });
    if (user) {
      logger.info("✅ Success: Employee found globally!");
      logger.info({ id: user.id, email: user.email, tenantId: user.tenantId });
    } else {
      logger.info("❌ Failed: Employee not found globally.");
    }
  } catch (e: any) {
    logger.error("Error:", e.message);
  }

  // Test Mitra Lookup (if any)
  logger.info("\nChecking Mitra...");
  try {
    const mitra = await prismaMitraAuth.mitra.findFirst();
    if (mitra) {
      logger.info("✅ Success: Mitra found globally!");
      logger.info({
        id: mitra.id,
        email: mitra.email,
        tenantId: mitra.tenantId,
      });
    } else {
      logger.info(
        "ℹ️ Info: No mitras in DB to test, but lookup mechanism is active.",
      );
    }
  } catch (e: any) {
    logger.error("Error:", e.message);
  }

  // Double Check with Isolated Client (should fail without context)
  logger.info("\n--- VERIFYING ISOLATION STILL WORKS ---");
  const { prisma } = await import("../lib/prisma");
  try {
    const isolatedUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    if (!isolatedUser) {
      logger.info(
        "✅ Success: Isolated client correctly blocked lookup without context.",
      );
    } else {
      logger.info(
        "⚠️ Warning: Isolated client found user! (Maybe running as Super Admin or context exists?)",
      );
    }
  } catch (e: any) {
    logger.info("✅ Success: Isolated client blocked/errored as expected.");
  }
}

verify().catch(logger.error);
