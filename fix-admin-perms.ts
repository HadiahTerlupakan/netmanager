
import { prisma } from './lib/prisma';

async function main() {
  console.log('Fixing SUPER_ADMIN Permissions...');

  const roleName = 'SUPER_ADMIN';
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    console.error(`Role ${roleName} not found!`);
    return;
  }

  // Permission to remove
  const badPermission = await prisma.permission.findFirst({
    where: {
      resource: 'workorders',
      action: 'site_only',
    },
  });

  if (badPermission) {
    const roleHasPerm = await prisma.role.findFirst({
      where: {
        id: role.id,
        permission: {
          some: {
            id: badPermission.id,
          },
        },
      },
    });

    if (roleHasPerm) {
      console.log(`Removing ${badPermission.resource}:${badPermission.action} from ${roleName}`);
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permission: {
            disconnect: { id: badPermission.id },
          },
        },
      });
      console.log('Permission removed.');
    } else {
      console.log(`${roleName} does not have the restrictive permission.`);
    }
  } else {
    console.log('Permission workorders:site_only not found in DB.');
  }

  console.log('SUPER_ADMIN permissions fixed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // await prisma.$disconnect(); 
  });
