
import { prisma } from './lib/prisma';

async function main() {
  const roleName = 'THD';
  const resource = 'workorders';
  const action = 'read_all_departments';

  console.log(`Configuring permission '${action}' for Role '${roleName}'...`);

  // 1. Find the Role
  const role = await prisma.role.findFirst({
    where: { name: roleName }
  });

  if (!role) {
    console.error(`Role ${roleName} not found!`);
    return;
  }

  // 2. Check if Permission exists, or create it
  // We check by resource+action usually, but ID might be auto-generated.
  // We'll search first.
  let permission = await prisma.permission.findFirst({
    where: {
      resource,
      action
    }
  });

  if (!permission) {
    console.log('Permission not found. Creating...');
    permission = await prisma.permission.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Read All Departments Workorders',
        description: 'Allow viewing workorders from all departments',
        resource,
        action,
        updatedAt: new Date()
      }
    });
    console.log('Permission created:', permission.id);
  } else {
    console.log('Permission already exists:', permission.id);
  }

  // 3. Assign Permission to Role
  // Check if already assigned
  const roleWithPerm = await prisma.role.findUnique({
    where: { id: role.id },
    include: {
      permission: {
        where: { id: permission.id }
      }
    }
  });

  if (roleWithPerm?.permission.length) {
    console.log('Role already has this permission.');
  } else {
    console.log('Assigning permission to role...');
    await prisma.role.update({
      where: { id: role.id },
      data: {
        permission: {
            connect: { id: permission.id }
        }
      }
    });
    console.log('Permission assigned successfully!');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
