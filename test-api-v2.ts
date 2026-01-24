import { prisma } from './lib/prisma';
async function main() {
  try {
    const groups = await prisma.mixRadiusOwnerGroup.findMany({
      include: { site: true }
    });
    console.log('✅ DATABASE QUERY SUCCESSFUL');
    console.log('Groups found:', groups.length);
    if (groups.length > 0) {
      console.log('Sample group site data:', groups[0].site ? groups[0].site.name : 'No site mapped');
    }
  } catch (err) {
    console.error('❌ DATABASE QUERY FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
