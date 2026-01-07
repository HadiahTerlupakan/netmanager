
import { prisma } from './lib/prisma';

async function main() {
    const userId = 'cmjgsiz2v000fqt1gp5f524fq';
    console.log(`Checking user: ${userId}`);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, departmentId: true, siteId: true }
    });

    console.log('User Data:', user);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
