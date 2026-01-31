#!/usr/bin/env npx tsx
/**
 * Script untuk generate API user untuk router yang belum punya
 * Jalankan: npx tsx scripts/generate-api-users.ts
 */

import { prisma } from '../lib/prisma';
import { MikroTikProvisioningService } from '../modules/network/services/MikroTikProvisioningService';

async function main() {
  console.log('Finding routers without generated API user...');
  
  const routers = await prisma.mikroTikRouter.findMany({
    where: {
      apiUsernameGenerated: null
    }
  });

  console.log(`Found ${routers.length} router(s) without generated API user`);

  const provisioningService = new MikroTikProvisioningService();

  for (const router of routers) {
    console.log(`\nProcessing router: ${router.name} (${router.ipAddress})`);
    
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
          }
        });
        console.log(`✅ Success! Created user: ${result.username}`);
      } else {
        console.log(`❌ Failed: ${result.logs.join(', ')}`);
      }
    } catch (error: unknown) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main();
