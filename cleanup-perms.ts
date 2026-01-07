
import { prisma } from './lib/prisma';

async function main() {
  console.log('Cleaning up old permissions...');

  const resource = 'workorders';
  const oldAction = 'read_all_departments';

  const oldPerm = await prisma.permission.findFirst({
    where: { resource, action: oldAction }
  });

  if (oldPerm) {
    console.log(`Found old permission ${resource}:${oldAction}. Deleting...`);
    // Delete permission - this will automatically disconnect from roles due to relation
    try {
        await prisma.permission.delete({
            where: { id: oldPerm.id }
        });
        console.log('Old permission deleted.');
    } catch (e) {
        console.error('Error deleting old permission (might be in use?):', e);
    }
  } else {
    console.log('Old permission not found.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    // await prisma.$disconnect();
  });
