
import { prisma } from './lib/prisma';

async function main() {
  console.log('Fixing Teknisi Permissions...');

  const roleName = 'teknisi';
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    console.error(`Role ${roleName} not found!`);
    return;
  }

  // Permissions to ensure exist and are assigned
  const permissionsToAdd = [
    { resource: 'workorders', action: 'read', description: 'View work orders' },
    { resource: 'workorders', action: 'update', description: 'Update work orders' },
    // Adding create just in case, though mainly they update
    { resource: 'workorders', action: 'create', description: 'Create work orders' },
  ];

  for (const perm of permissionsToAdd) {
    // 1. Ensure permission exists
    let permission = await prisma.permission.findFirst({
      where: {
        resource: perm.resource,
        action: perm.action,
      },
    });

    if (!permission) {
      console.log(`Creating permission: ${perm.resource}:${perm.action}`);
      permission = await prisma.permission.create({
        data: {
          id: crypto.randomUUID(),
          name: `Permission ${perm.resource}:${perm.action}`,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
          updatedAt: new Date(),
        },
      });
    }

    // 2. Assign to role if not already assigned
    const roleHasPerm = await prisma.role.findFirst({
      where: {
        id: role.id,
        permission: {
          some: {
            id: permission.id,
          },
        },
      },
    });

    if (!roleHasPerm) {
      console.log(`Assigning ${perm.resource}:${perm.action} to ${roleName}`);
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permission: {
            connect: { id: permission.id },
          },
        },
      });
    } else {
      console.log(`${roleName} already has ${perm.resource}:${perm.action}`);
    }
  }

  console.log('Teknisi permissions fixed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // await prisma.$disconnect();
  });
