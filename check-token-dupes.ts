
import { prisma } from './lib/prisma';

async function main() {
    const token = 'ExponentPushToken[vSJuIvE-GjOVwceZzA4Ymm]';
    console.log(`Checking which USERS have token: ${token}`);

    const users = await prisma.user.findMany({
        where: { pushToken: token },
        select: { id: true, name: true, email: true, role: { select: { name: true } } }
    });

    console.log(`Found ${users.length} users with this token.`);
    users.forEach(u => {
        console.log(`- User: ${u.name} (${u.email}) - Role: ${u.role?.name} - ID: ${u.id}`);
    });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
