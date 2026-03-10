import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

interface RestockRequestStatusInput {
  purchaseOrderId: string
  action: unknown
  items?: Record<string, number>
  closePO?: boolean
  actorId: string
}

export async function patchRestockRequestStatus({
  purchaseOrderId,
  action,
  items = {},
  closePO,
  actorId,
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

    if (po.status !== 'ORDERED' && po.status !== 'PARTIAL') {
      return NextResponse.json({ error: 'Hanya PO dalam proses yang bisa diterima' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of po.items) {
        const receivedQty = items[item.id] || 0

        if (receivedQty > 0) {
          let targetGudangId = ''
          const shipToMatch = po.notes?.match(/\[Ship To Warehouse: (.*?) -/)
          if (shipToMatch && shipToMatch[1]) {
            const parsedId = shipToMatch[1].trim()
            const exists = await tx.gudang.findUnique({ where: { id: parsedId } })
            if (exists) {
              targetGudangId = parsedId
            }
          }

          if (!targetGudangId) {
            const firstGudang = await tx.gudang.findFirst({ where: { isActive: true } })
            if (firstGudang) {
              targetGudangId = firstGudang.id
            } else {
              const anyGudang = await tx.gudang.findFirst()
              if (anyGudang) {
                targetGudangId = anyGudang.id
              }
            }
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
              keterangan: `Penerimaan dari PO #${po.poNumber}`,
              kondisi: 'BARU',
              userId: actorId,
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
      let updatedTotalAmount = po.totalAmount

      if (closePO) {
        let recalculatedTotal = 0
        const itemUpdates = []

        for (const item of po.items) {
          const receivedQty = items[item.id] || 0
          const newTotalPrice = receivedQty * item.unitPrice
          recalculatedTotal += newTotalPrice

          if (receivedQty !== item.quantity) {
            itemUpdates.push(
              tx.purchaseOrderItem.update({
                where: { id: item.id },
                data: {
                  quantity: receivedQty,
                  totalPrice: newTotalPrice,
                },
              })
            )
          }
        }

        if (itemUpdates.length > 0) {
          await Promise.all(itemUpdates)
        }
        updatedTotalAmount = recalculatedTotal
      }

      const updatedPO = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: newStatus as 'RECEIVED' | 'PARTIAL',
          ...(newStatus === 'RECEIVED' && { receivedById: actorId }),
          totalAmount: updatedTotalAmount,
          updatedAt: new Date(),
        },
      })

      return updatedPO
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error updating PO:', error)
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
