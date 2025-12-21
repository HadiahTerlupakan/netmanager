import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const stocks = await prisma.barangGudang.findMany({ take: 10 })
    console.log('=== BarangGudang Records ===')
    for (const stock of stocks) {
        console.log(JSON.stringify(stock, null, 2))
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
