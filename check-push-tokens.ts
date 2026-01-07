
import { prisma } from './lib/prisma';

async function main() {
    const token = 'ExponentPushToken[vSJuIvE-GjOVwceZzA4Ymm]';
    console.log(`Checking owernship of token: ${token}`);

    const users = await prisma.user.findMany({
        where: { pushToken: token }
    });

    console.log(`Found ${users.length} entries for this token.`);
    users.forEach(u => {
        console.log(`- Owned by User: ${u.name} (${u.id}) - CreatedAt: ${u.createdAt}`);
    });

    if (users.length === 0) {
        console.log("Token not found in database.");
    }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
