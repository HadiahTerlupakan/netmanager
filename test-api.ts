import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const groups = await prisma.mixRadiusOwnerGroup.findMany({
    include: { site: true }
  });
  console.log('API RESPONSE SIMULATION:', JSON.stringify(groups, null, 2));
}
main();
