
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const odps = await prisma.odp.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, images: true }
  })

  console.log('Latest 5 ODPs:')
  odps.forEach(odp => {
    console.log(`ODP: ${odp.name} (ID: ${odp.id})`)
    console.log(`Images: ${JSON.stringify(odp.images)}`)
    console.log('---')
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
