process.env.IS_SEEDING = "true";
import { prismaAuth } from "../lib/prisma";
import { compare } from "bcryptjs";
import { logger } from "../lib/logger";

async function main() {
  logger.info("--- ADVANCED AUTH DEBUG ---");

  const testUsers = [
    { email: "rohadimraja@gmail.com", password: "pentagon202#" },
    { email: "dede@sblnet.id", password: "123456789" },
    { email: "dede@sbLnet.id", password: "123456789" },
  ];

  for (const test of testUsers) {
    logger.info(`\nChecking: "${test.email}"`);

    // Test Case-Sensitive Lookup
    const user = await prismaAuth.user.findUnique({
      where: { email: test.email },
    });

    if (!user) {
      logger.info(`   ❌ findUnique failed (Case Sensitive)`);

      // Try Case-Insensitive Just to confirm existence
      const userInsensitive = await prismaAuth.user.findFirst({
        where: { email: { equals: test.email, mode: "insensitive" } },
      });
      if (userInsensitive) {
        logger.info(
          `   💡 Found via Case-Insensitive: ${userInsensitive.email}`,
        );
      }
    } else {
      logger.info(`   ✅ findUnique success`);
      if (user.passwordHash) {
        const ok = await compare(test.password, user.passwordHash);
        logger.info(
          `   Password Match ("${test.password}"): ${ok ? "✅ YES" : "❌ NO"}`,
        );
        logger.info(`   Hash: ${user.passwordHash}`);
      } else {
        logger.info(`   ❌ No passwordHash`);
      }
    }
  }
}

main();
