const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const pelangganId = '53f71a1a-0231-4be3-aa23-62b4f070aa56'
  console.log(`Checking invoices for pelangganId: ${pelangganId}`)

  const invoices = await prisma.invoice.findMany({
    where: {
      pelangganId: pelangganId
    }
  })

  console.log(`Found ${invoices.length} invoices:`)
  console.log(JSON.stringify(invoices, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
