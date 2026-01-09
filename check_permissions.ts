
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('Checking permissions...');
    const perms = await prisma.permission.findMany({
        where: {
            resource: 'workorders',
            action: { in: ['cancel', 'verify'] }
        }
    });
    console.log('Found permissions:', perms);
}

check()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
