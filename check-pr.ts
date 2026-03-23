import { prisma } from './lib/prisma'

async function main() {
  try {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { nomorRequest: 'PR-20260323-0001' },
      include: {
        items: {
          include: {
            barang: true
          }
        }
      }
    })

    if (!pr) {
      console.log('Purchase Request not found')
      return
    }

    console.log(JSON.stringify(pr, null, 2))
  } catch (error) {
    console.error('Error fetching PR:', error)
  }
}

main()
  .finally(async () => {
    // lib/prisma exports the extended client, closing it might vary
  })
