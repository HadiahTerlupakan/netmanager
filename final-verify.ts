import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const group = await prisma.mixRadiusOwnerGroup.create({
        data: {
            name: 'Verification Group',
            owners: ['test'],
            siteId: null,
            isActive: true
        }
    });
    console.log('✅ Create successful with siteId (null)');
    
    await prisma.mixRadiusOwnerGroup.update({
        where: { id: group.id },
        data: { name: 'Verified Group', siteId: null }
    });
    console.log('✅ Update successful');
    
    await prisma.mixRadiusOwnerGroup.delete({
        where: { id: group.id }
    });
    console.log('✅ Delete successful');
    console.log('🚀 FINAL VERIFICATION PASSED');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await prisma.();
  }
}
main();
