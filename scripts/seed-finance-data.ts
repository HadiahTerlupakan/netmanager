import { PrismaClient } from "@prisma/client";
import { prismaBilling } from "../lib/prisma-billing";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { logger } from "../lib/logger";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  logger.info("Start seeding finance data...");

  // 1. Dihapus karena schema TransactionCategory sudah obsolete
  // 2. Seed Financial Accounts
  const accounts = [
    {
      name: "Kas Kecil (Petty Cash)",
      type: "CASH",
      balance: 5000000,
      description: "Untuk pengeluaran operasional harian",
    },
    {
      name: "Bank BCA",
      type: "BANK",
      balance: 100000000,
      description: "Rekening Operasional Utama",
      accountNumber: "1234567890",
    },
    {
      name: "Bank Mandiri",
      type: "BANK",
      balance: 50000000,
      description: "Rekening Payroll",
      accountNumber: "0987654321",
    },
  ];

  for (const acc of accounts) {
    const exists = await prisma.financialAccount.findFirst({
      where: { name: acc.name },
    });

    if (!exists) {
      await prisma.financialAccount.create({
        data: {
          name: acc.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: acc.type as any,
          balance: acc.balance,
          description: acc.description,
          accountNumber: acc.accountNumber,
          isActive: true,
        },
      });
      logger.info(`Created account: ${acc.name}`);
    } else {
      logger.info(`Account exists: ${acc.name}`);
    }
  }

  logger.info("Seeding finished.");
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
