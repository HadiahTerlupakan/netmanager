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
        },
        purchaseOrder: {
          include: {
            items: {
              include: {
                barang: true
              }
            }
          }
        }
      }
    })

    if (!pr) {
      console.log('Purchase Request not found')
      return
    }

    console.log('PR Status:', pr.status)
    console.log('Linked PO Status:', pr.purchaseOrder?.status)
    console.log('Items Detail:')
    
    pr.items.forEach(item => {
      const poItem = pr.purchaseOrder?.items.find(poi => poi.barangId === item.barangId)
      console.log(`- ${item.barang.nama} (${item.barang.kode}):`)
      console.log(`  PR Requested: ${item.jumlah}`)
      console.log(`  PO Ordered: ${poItem?.quantity || 0}`)
      console.log(`  PO Received: ${poItem?.receivedQuantity || 0}`)
    })

  } catch (error) {
    console.error('Error fetching PR:', error)
  }
}

main()
