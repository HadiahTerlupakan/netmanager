process.env.IS_SEEDING = 'true'
import { prisma } from './lib/prisma'

async function main() {
  try {
    const requests = await prisma.purchaseRequest.findMany({
      take: 1,
      include: {
        items: {
          include: { barang: true }
        },
        requester: { select: { name: true } },
        approver: { select: { name: true } },
        gudang: { select: { nama: true, id: true } }
      }
    })
    console.log('SUCCESS: Data fetched successfully')
    console.log('Count:', requests.length)
  } catch (error) {
    console.error('ERROR FETCHING DATA:')
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
