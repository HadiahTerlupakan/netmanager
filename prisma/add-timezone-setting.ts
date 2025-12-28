/**
 * Add GENERAL_TIMEZONE setting to database
 */
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const result = await prisma.settings.upsert({
    where: { key: 'GENERAL_TIMEZONE' },
    update: { value: 'Asia/Jakarta' },
    create: {
      id: randomUUID(),
      key: 'GENERAL_TIMEZONE',
      value: 'Asia/Jakarta',
      description: 'Timezone aplikasi (IANA format)',
      updatedAt: new Date()
    }
  })
  console.log('✅ GENERAL_TIMEZONE setting:', result.value)
  
  // Also add attendance tolerance if missing
  await prisma.settings.upsert({
    where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' },
    update: {},
    create: {
      id: randomUUID(),
      key: 'GENERAL_ATTENDANCE_TOLERANCE',
      value: '15',
      description: 'Toleransi keterlambatan absensi (menit)',
      updatedAt: new Date()
    }
  })
  console.log('✅ GENERAL_ATTENDANCE_TOLERANCE setting checked')
  
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
