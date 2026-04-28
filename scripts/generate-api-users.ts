#!/usr/bin/env npx tsx
/**
 * Script untuk generate API user untuk router yang belum punya
 * Jalankan: npx tsx scripts/generate-api-users.ts
 */

import { prisma } from "../lib/prisma";
import { MikroTikProvisioningService } from "../modules/network/services/MikroTikProvisioningService";
import { logger } from "../lib/logger";

async function main() {
  logger.info("Finding routers without generated API user...");

  const routers = await prisma.mikroTikRouter.findMany({
    where: {
      apiUsernameGenerated: null,
    },
  });

  logger.info(`Found ${routers.length} router(s) without generated API user`);

  const provisioningService = new MikroTikProvisioningService();

  for (const router of routers) {
    logger.info(`\nProcessing router: ${router.name} (${router.ipAddress})`);

    try {
      const result = await provisioningService.createApiUser({
        ip: router.ipAddress,
        port: router.apiPort,
        username: router.apiUsername,
        password: router.apiPassword,
      });

      if (result.success && result.username && result.password) {
        await prisma.mikroTikRouter.update({
          where: { id: router.id },
          data: {
            apiUsernameGenerated: result.username,
            apiPasswordGenerated: result.password,
          },
        });
        logger.info(`✅ Success! Created user: ${result.username}`);
      } else {
        logger.info(`❌ Failed: ${result.logs.join(", ")}`);
      }
    } catch (error: unknown) {
      logger.info(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.info("\nDone!");
  await prisma.$disconnect();
}

main();
