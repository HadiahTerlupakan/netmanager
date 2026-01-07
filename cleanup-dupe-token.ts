
import { prisma } from './lib/prisma';

async function main() {
    const token = 'ExponentPushToken[vSJuIvE-GjOVwceZzA4Ymm]';
    // User who SHOULD have it: Technician (cmjgsiz2v000fqt1gp5f524fq)
    // User who SHOULD NOT have it: Admin (cmjfrgc3y009kp2bossxko2qj)
    
    console.log(`Cleaning up duplicates for token: ${token}`);

    // Remove from everyone NOT the technician
    const result = await prisma.user.updateMany({
        where: {
            pushToken: token,
            id: { not: 'cmjgsiz2v000fqt1gp5f524fq' } 
        },
        data: {
            pushToken: null,
            pushTokenUpdatedAt: null
        }
    });

    console.log(`Removed token from ${result.count} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
