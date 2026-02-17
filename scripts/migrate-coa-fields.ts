import { prisma } from "../lib/prisma";

async function main() {
  console.log('Starting COA migration...');

  // 1. Reset all to leaf node state first
  await prisma.chartOfAccount.updateMany({
    data: {
      isHeader: false,
      allowPosting: true,
    },
  });

  // 2. Find all accounts that are parents (have children)
  const parentAccounts = await prisma.chartOfAccount.findMany({
    where: {
      children: {
        some: {},
      },
    },
  });

  // 3. Update parents to be headers
  for (const account of parentAccounts) {
    await prisma.chartOfAccount.update({
      where: { id: account.id },
      data: {
        isHeader: true,
        allowPosting: false,
      },
    });
    console.log(`Updated ${account.code} - ${account.name} as Header`);
  }

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
