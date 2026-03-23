import { prisma } from './lib/prisma'

async function repair() {
  console.log('🚀 Memulai perbaikan tenantId yang kosong secara otomatis...')

  try {
    // 1. Perbaiki PurchaseRequestItem
    const prItems = await prisma.purchaseRequestItem.findMany({
      where: { tenantId: null },
      include: { purchaseRequest: true }
    })

    console.log(`📦 Ditemukan ${prItems.length} item PR bermasalah.`)
    for (const item of prItems) {
      if (item.purchaseRequest?.tenantId) {
        await prisma.purchaseRequestItem.update({
          where: { id: item.id },
          data: { tenantId: item.purchaseRequest.tenantId }
        })
        console.log(`   ✅ Fixed PR Item: ${item.id}`)
      }
    }

    // 2. Perbaiki PurchaseOrderItem
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { tenantId: null },
      include: { purchaseOrder: true }
    })

    console.log(`📄 Ditemukan ${poItems.length} item PO bermasalah.`)
    for (const item of poItems) {
      if (item.purchaseOrder?.tenantId) {
        await prisma.purchaseOrderItem.update({
          where: { id: item.id },
          data: { tenantId: item.purchaseOrder.tenantId }
        })
        console.log(`   ✅ Fixed PO Item: ${item.id}`)
      }
    }

    console.log('✨ Semua data telah diperbaiki!')
  } catch (error) {
    console.error('❌ Gagal memperbaiki data:', error)
  }
}

repair()
