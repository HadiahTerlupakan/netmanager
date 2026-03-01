import { PrismaClient as PrismaMain } from '@prisma/client'
import { PrismaClient as PrismaMitra } from '../prisma/generated/mitra'
import { logger } from '../lib/logger'

const prismaMain = new PrismaMain()
const prismaMitra = new PrismaMitra()

async function main() {
    console.log('Starting Mitra Data Migration...')
    // Define logic to fetch data from main db and insert into mitra db.
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prismaMain.$disconnect()
        await prismaMitra.$disconnect()
    })
