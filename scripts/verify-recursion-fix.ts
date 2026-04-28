import { verifyMobileToken, signMobileToken } from "../lib/mobile-auth";
import { prismaAuth } from "../lib/prisma";
import { logger } from "../lib/logger";

async function verify() {
  logger.info("--- VERIFYING CIRCULAR DEPENDENCY FIX ---");

  // 1. Find a real user to test with
  const user = await prismaAuth.user.findFirst({
    where: { email: "dede@sblnet.id" },
  });

  if (!user) {
    logger.error("❌ Test user not found. Please run seed first.");
    return;
  }

  logger.info(`Testing with user: ${user.email} (${user.id})`);

  // 2. Sign a token
  const token = await signMobileToken({
    id: user.id,
    email: user.email,
    role: "ADMIN",
  });
  logger.info("✅ Token signed successfully");

  // 3. Verify the token
  // If the circular dependency still exists, this will hang or flood the console
  logger.info("Starting verification (should not hang)...");
  const payload = await verifyMobileToken(token);

  if (payload) {
    logger.info("✅ Token verified successfully without infinite loop!");
    logger.info("User ID from payload:", payload.userId);
    logger.info("Tenant ID from payload:", payload.tenantId);
  } else {
    logger.error("❌ Token verification failed (but at least it didn't loop!)");
  }

  logger.info("\n--- VERIFYING CASE-INSENSITIVE LOOKUP ---");
  // Note: verifyMobileToken doesn't handle lookup by email, only the LOGIN route does.
  // But we can check if prismaAuth.user responds to case-insensitive queries.
  const userUpper = await prismaAuth.user.findFirst({
    where: { email: { equals: "DEDE@SBLNET.ID", mode: "insensitive" } },
  });

  if (userUpper && userUpper.id === user.id) {
    logger.info("✅ Case-insensitive database lookup works!");
  } else {
    logger.error("❌ Case-insensitive database lookup failed!");
  }
}

verify().catch(logger.error);
