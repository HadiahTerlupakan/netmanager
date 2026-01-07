
import { prisma } from './lib/prisma';

async function main() {
  const userId = 'cmjgsiz2v000fqt1gp5f524fq'; // ID from logs
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  console.log('User Details:', JSON.stringify(user, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
