
import { prisma } from './lib/prisma';

async function main() {
  // Finding System Administrator by name or email (usually admin@example.com)
  const admin = await prisma.user.findFirst({
    where: { name: 'System Administrator' },
    include: {
      departments: true,
      sites: true,
      role: {
        include: {
            permission: {
                where: { resource: 'workorders' }
            }
        }
      }
    }
  });

  console.log('Admin Details:', JSON.stringify(admin, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
