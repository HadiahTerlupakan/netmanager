
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'rama@sblnet.id';
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log(`User ${email} not found`);
    return;
  }

  console.log(`User found: ${user.name} (${user.id})`);

  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  console.log(`Checking attendance between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

  const attendance = await prisma.attendance.findMany({
    where: {
      userId: user.id,
      checkIn: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  console.log(`Found ${attendance.length} records:`);
  console.log(JSON.stringify(attendance, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
