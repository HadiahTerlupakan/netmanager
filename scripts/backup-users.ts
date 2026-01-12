import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('💾 Backing up users and custom roles...');

  // 1. Backup Roles (to ensure custom roles are preserved)
  const roles = await prisma.role.findMany({
    include: {
      permission: true
    }
  });

  // 2. Backup Users (with role name for re-linking)
  const users = await prisma.user.findMany({
    include: {
      role: {
        select: { name: true }
      }
    }
  });

  const backupData = {
    roles,
    users,
    timestamp: new Date().toISOString()
  };

  const backupPath = path.join(process.cwd(), 'prisma', 'user_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  console.log(`✅ Backup saved to ${backupPath}`);
  console.log(`   - ${roles.length} Roles`);
  console.log(`   - ${users.length} Users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
