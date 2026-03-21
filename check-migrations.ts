
import { prisma } from './lib/prisma';

async function main() {
  const migrations = await prisma.$queryRawUnsafe('SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at');
  console.log(JSON.stringify(migrations, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
