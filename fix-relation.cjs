
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Disconnecting Gudang Cariu from Site HQ...');
  // Gudang ID: cmjfu2edf0004of1gdzea57x0
  // Site ID: cmjfrgc0c0091p2bopeft176t
  try {
      await prisma.sites.update({
          where: { id: 'cmjfrgc0c0091p2bopeft176t' },
          data: {
              gudang: {
                  disconnect: { id: 'cmjfu2edf0004of1gdzea57x0' }
              }
          }
      });
      console.log('Successfully disconnected.');
  } catch (e) {
      console.error('Error:', e);
  } finally {
      await prisma.$disconnect();
  }
}

main();
