
import { prisma } from './lib/prisma';

async function main() {
  console.log('Migrating to department_only permission model...');

  const resource = 'workorders';
  const newAction = 'department_only';
  const oldAction = 'read_all_departments';

  // 1. Create 'department_only' permission if it doesn't exist
  let depOnlyPerm = await prisma.permission.findFirst({
    where: { resource, action: newAction }
  });

  if (!depOnlyPerm) {
    console.log(`Creating permission ${resource}:${newAction}...`);
    depOnlyPerm = await prisma.permission.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Department Restricted Workorders',
        description: 'Restrict user to only see workorders from their department',
        resource,
        action: newAction,
        updatedAt: new Date()
      }
    });
  }

  // 2. Identify roles that should be RESTRICTED (Assign department_only)
  // Logic: Originally, everyone was restricted unless they had read_all_departments.
  // So, everyone who DOES NOT have read_all_departments should get department_only.
  // Exception: 'SUPER_ADMIN' usually has all access (no restrictions), so we skip assigning it if not needed, 
  // BUT broadly, valid roles without read_all_departments need the restriction now.
  
  // Actually, let's look at it:
  // - Teknisi: Need restriction.
  // - Admin (Site Admin): Need restriction? Usually yes.
  // - Helpers/Staff: Need restriction.
  // - THD (Helpdesk): SHOULD NOT have restriction.
  // - SUPER_ADMIN: SHOULD NOT have restriction.

  // Fetch all roles
  const roles = await prisma.role.findMany({
    include: {
      permission: true
    }
  });

  for (const role of roles) {
    const hasReadAll = role.permission.some(p => p.resource === resource && p.action === oldAction);
    const isSuperAdmin = role.name === 'SUPER_ADMIN'; 

    // Who needs restriction?
    // Anyone who currently LACKS 'read_all_departments' AND is not Super Admin (implicit).
    // Actually SUPER_ADMIN logic in Service might bypass permissions anyway, but cleaner to just not assign restriction.
    
    // BUT wait, in the NEW logic:
    // "No department_only" = Access All.
    // "Has read_all_departments" = Access All (Old way).
    // So if a role currently is RESTRICTED (does not have read_all), we MUST assign 'department_only' to invoke restriction.
    
    if (!hasReadAll && !isSuperAdmin) {
       console.log(`Role '${role.name}' matches criteria for restriction. Assigning ${newAction}...`);
       
       // Check if already has it
       const hasDepOnly = role.permission.some(p => p.id === depOnlyPerm!.id);
       if (!hasDepOnly) {
          await prisma.role.update({
            where: { id: role.id },
            data: {
              permission: {
                connect: { id: depOnlyPerm!.id }
              }
            }
          });
       }
    } else {
      console.log(`Role '${role.name}' does NOT need restriction (Has read_all or is SuperAdmin).`);
    }
  }

  // 3. Remove the old 'read_all_departments' permission from roles and DB
  /*
  const oldPerm = await prisma.permission.findFirst({
    where: { resource, action: oldAction }
  });

  if (oldPerm) {
    console.log(`Removing old permission ${resource}:${oldAction} from all roles...`);
    // Delete permission (cascades to disconnect from roles usually? Or we disconnect first)
    // Prisma delete cascades if configured, but let's be safe and just delete the permission if no constraints block it.
    // Actually, usually Many-to-Many relation table handles it.
    
    // We can just leave it or delete it. Deleting cleans up.
    try {
        await prisma.permission.delete({
            where: { id: oldPerm.id }
        });
        console.log('Old permission deleted.');
    } catch (e) {
        console.error('Error deleting old permission (might be in use?):', e);
    }
  }
  */
  // COMMENTED OUT DELETION for safety until verified. keeping it for now won't hurt.
  
  console.log('Migration finished.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    // await prisma.$disconnect();
  });
