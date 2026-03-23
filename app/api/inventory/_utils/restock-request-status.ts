import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

interface RestockRequestStatusInput {
  purchaseOrderId: string
  action: unknown
  items?: Record<string, number>
  closePO?: boolean
  actorId: string
  fotoBukti?: string[]
}

export async function patchRestockRequestStatus({
  purchaseOrderId,
  action,
  items = {},
  closePO,
  actorId,
  fotoBukti = [],
}: RestockRequestStatusInput) {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: {
          include: { barang: true },
        },
      },
    })

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }

    if (action === 'START_SHOPPING') {
      if (po.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Hanya PO Draft yang bisa mulai diproses' }, { status: 400 })
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: 'ORDERED',
          processedById: actorId,
          updatedAt: new Date(),
        },
      })

      return NextResponse.json(updated)
    }

    if (action !== 'RECEIVE') {
      return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 })
    }

    if (po.status !== 'DRAFT' && po.status !== 'ORDERED' && po.status !== 'PARTIAL') {
      return NextResponse.json({ error: 'Hanya PO dalam proses yang bisa diterima' }, { status: 400 })
    }

    // Business Rule: Photo is required for receipt
    if (!fotoBukti || fotoBukti.length === 0) {
      return NextResponse.json({ error: 'Foto bukti penerimaan barang wajib diunggah' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch PO items inside transaction for data consistency
      const freshPO = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: {
          items: {
            include: { barang: true },
          },
        },
      })

      if (!freshPO || freshPO.items.length === 0) {
        throw new Error('Purchase Order tidak memiliki items')
      }

      for (const item of freshPO.items) {
        // RECEIVED QUANTITY - support both barangId key (new) and item.id key (legacy)
        const receivedQty = items[item.barangId] !== undefined ? items[item.barangId] : (items[item.id] !== undefined ? items[item.id] : 0)

        if (receivedQty < 0) {
          throw new Error(`Jumlah diterima untuk ${item.barang.nama} tidak boleh negatif`)
        }

        // ALWAYS update the receivedQuantity in PO Item to track that it was processed
        const currentReceived = item.receivedQuantity || 0
        const newReceivedTotal = currentReceived + receivedQty

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { 
            receivedQuantity: newReceivedTotal
          }
        })

        // ONLY add stock and create history if quantity is greater than 0
        if (receivedQty > 0) {
          // Robust Warehouse Detection: Use the gudangId from the associated PurchaseRequest
          let targetGudangId = ''
          
          const linkedPR = await tx.purchaseRequest.findFirst({
            where: { purchaseOrderId },
            select: { gudangId: true }
          })

          if (linkedPR) {
            targetGudangId = linkedPR.gudangId
          }

          // Fallback only if absolutely necessary
          if (!targetGudangId) {
            const firstGudang = await tx.gudang.findFirst({ where: { isActive: true } })
            targetGudangId = firstGudang?.id || ''
          }

          if (!targetGudangId) {
            throw new Error('Tidak ada Gudang yang tersedia untuk menyimpan barang. Harap buat Gudang terlebih dahulu.')
          }

          const now = new Date()
          await tx.barangGudang.upsert({
            where: {
              barangId_gudangId: {
                barangId: item.barangId,
                gudangId: targetGudangId,
              },
            },
            create: {
              id: crypto.randomUUID(),
              barangId: item.barangId,
              gudangId: targetGudangId,
              stok: receivedQty,
              stokBaru: receivedQty,
              stokBekas: 0,
              stokRusak: 0,
              updatedAt: now,
              createdAt: now,
            },
            update: {
              stok: { increment: receivedQty },
              stokBaru: { increment: receivedQty },
              updatedAt: now,
            },
          })

          const masuk = await tx.barangMasuk.create({
            data: {
              id: crypto.randomUUID(),
              barangId: item.barangId,
              gudangId: targetGudangId,
              jumlah: receivedQty,
              hargaBeliSatuan: item.unitPrice,
              tanggal: now,
              keterangan: `Penerimaan dari PO #${freshPO.poNumber} (Revisi/Partial)`,
              kondisi: 'BARU',
              userId: actorId,
              fotoBukti: fotoBukti, // Attach the photos to the stock-in record
            },
            include: {
              barang: true,
              gudang: true,
            },
          })

          if (masuk.barang && masuk.barang.jenis === 'ASET') {
            let usefulLife = 48
            if (masuk.barang.kategoriAset === 'KENDARAAN') usefulLife = 96
            if (masuk.barang.kategoriAset === 'BANGUNAN') usefulLife = 240
            if (masuk.barang.kategoriAset === 'FURNITURE') usefulLife = 96

            const assetsToCreate = []
            const prefix = `AST-${masuk.barang.kode}`
            const dateCode = new Date().toISOString().slice(2, 7).replace('-', '')
            const timestamp = Date.now().toString().slice(-6)

            for (let i = 0; i < receivedQty; i++) {
              const uniqueSuffix = `${timestamp}${String(i + 1).padStart(2, '0')}`
              assetsToCreate.push({
                barangId: item.barangId,
                kodeAsset: `${prefix}-${dateCode}-${uniqueSuffix}`,
                purchaseDate: now,
                purchasePrice: item.unitPrice,
                currentValue: item.unitPrice,
                usefulLife,
                residualValue: 0,
                status: 'ACTIVE' as const,
                location: masuk.gudang?.nama || 'Gudang Utama',
                assignedTo: null,
              })
            }

            if (assetsToCreate.length > 0) {
              await tx.asset.createMany({
                data: assetsToCreate.map((asset) => ({
                  id: crypto.randomUUID(),
                  ...asset,
                })),
              })
            }
          }
        }
      }

      const newStatus = closePO ? 'RECEIVED' : 'PARTIAL'
      
      // Update PO with photos and status
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: newStatus as 'RECEIVED' | 'PARTIAL',
          ...(newStatus === 'RECEIVED' && { receivedById: actorId }),
          fotoBukti: { push: fotoBukti }, // Store the proof photos in PO record
          updatedAt: new Date(),
        },
      })

      // Update linked PurchaseRequest status when PO is fully received
      if (newStatus === 'RECEIVED') {
        await tx.purchaseRequest.updateMany({
          where: { purchaseOrderId },
          data: { status: 'RECEIVED' },
        })
      }

      return updatedPO
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error updating PO:', error)
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
