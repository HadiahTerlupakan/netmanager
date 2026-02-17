
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding finance data...')

  // 1. Seed Transaction Categories (COA) - Expenses
  const expenseCategories = [
    { name: 'Biaya Operasional Kantor', type: 'EXPENSE', description: 'Listrik, Air, Internet, ATK' },
    { name: 'Biaya Gaji & Upah', type: 'EXPENSE', description: 'Gaji karyawan, bonus, tunjangan' },
    { name: 'Biaya Pemeliharaan Aset', type: 'EXPENSE', description: 'Service kendaraan, maintenance gedung' },
    { name: 'Biaya Pemasaran', type: 'EXPENSE', description: 'Iklan, promosi, event' },
    { name: 'Biaya Transportasi', type: 'EXPENSE', description: 'Bensin, tol, parkir' },
    { name: 'Biaya Sewa', type: 'EXPENSE', description: 'Sewa gedung, sewa server' },
    { name: 'Biaya Lain-lain', type: 'EXPENSE', description: 'Pengeluaran tak terduga' },
  ]

  for (const cat of expenseCategories) {
    const exists = await prisma.transactionCategory.findFirst({
      where: { name: cat.name, type: 'EXPENSE' }
    })
    
    if (!exists) {
      await prisma.transactionCategory.create({
        data: {
            name: cat.name,
            type: 'EXPENSE', // Type casting handled by Prisma based on schema enum
            description: cat.description
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any // Bypass strict typing for the enum string literal mismatch if any
      })
      console.log(`Created category: ${cat.name}`)
    } else {
      console.log(`Category exists: ${cat.name}`)
    }
  }

  // 2. Seed Financial Accounts
  const accounts = [
    { name: 'Kas Kecil (Petty Cash)', type: 'CASH', balance: 5000000, description: 'Untuk pengeluaran operasional harian' },
    { name: 'Bank BCA', type: 'BANK', balance: 100000000, description: 'Rekening Operasional Utama', accountNumber: '1234567890' },
    { name: 'Bank Mandiri', type: 'BANK', balance: 50000000, description: 'Rekening Payroll', accountNumber: '0987654321' },
  ]

  for (const acc of accounts) {
    const exists = await prisma.financialAccount.findFirst({
      where: { name: acc.name }
    })

    if (!exists) {
      await prisma.financialAccount.create({
        data: {
            name: acc.name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: acc.type as any,
            balance: acc.balance,
            description: acc.description,
            accountNumber: acc.accountNumber,
            isActive: true
        }
      })
      console.log(`Created account: ${acc.name}`)
    } else {
      console.log(`Account exists: ${acc.name}`)
    }
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
