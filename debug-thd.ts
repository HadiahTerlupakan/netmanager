
import { prisma } from './lib/prisma';

async function main() {
  // Finding THD user based on ID from logs 'cmjfuofys000gpa19aseh0n9m'
  const user = await prisma.user.findUnique({
    where: { id: 'cmjfuofys000gpa19aseh0n9m' },
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

  console.log('THD User Details:', JSON.stringify(user, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
