import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// POST - Add materials/barang to work order (creates barang keluar)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await req.json()
        const { items } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Items is required' }, { status: 400 })
        }

        const workOrder = await prisma.workOrders.findUnique({
            where: { id }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        if (workOrder.status !== 'IN_PROGRESS') {
            return NextResponse.json({ error: 'Work order harus dalam status IN_PROGRESS' }, { status: 400 })
        }

        // Process each item - create barang keluar and update stock
        const results = await prisma.$transaction(async (tx) => {
            const createdItems = []

            for (const item of items) {
                const { barangId, gudangId, jumlah, kondisi } = item

                // Check stock
                const barangGudang = await tx.barangGudang.findUnique({
                    where: {
                        barangId_gudangId: { barangId, gudangId }
                    },
                    include: { barang: true }
                })

                if (!barangGudang || barangGudang.stok < jumlah) {
                    throw new Error(`Stok tidak mencukupi untuk barang ${barangGudang?.barang?.nama || barangId}`)
                }

                // Create barang keluar
                const keluar = await tx.barangKeluar.create({
                    data: {
                        id: randomUUID(),
                        barangId,
                        gudangId,
                        jumlah,
                        kondisi: kondisi || 'BARU',
                        userId: session.user.id,
                        purpose: `Work Order: ${workOrder.workOrderNumber}`,
                        keterangan: `Digunakan untuk work order ${workOrder.workOrderNumber} - ${workOrder.title}`
                    },
                    include: { barang: true }
                })

                // Update stock
                await tx.barangGudang.update({
                    where: {
                        barangId_gudangId: { barangId, gudangId }
                    },
                    data: {
                        stok: { decrement: jumlah }
                    }
                })

                createdItems.push({
                    id: keluar.id,
                    nama: keluar.barang.nama,
                    jumlah,
                    satuan: keluar.barang.satuan,
                    kondisi: kondisi || 'BARU'
                })
            }

            // Update work order usedMaterials
            const existingMaterials = (workOrder.usedMaterials as any[]) || []
            await tx.workOrders.update({
                where: { id },
                data: {
                    usedMaterials: [...existingMaterials, ...createdItems]
                }
            })

            // Log to Activity Timeline
            const materialList = createdItems.map(m => `${m.nama} - ${m.kondisi} (${m.jumlah} ${m.satuan})`).join(', ')
            await tx.workOrderUpdates.create({
                data: {
                    id: randomUUID(),
                    workOrderId: id,
                    createdById: session.user.id,
                    updateType: 'MATERIAL_PICKUP',
                    message: `Mengambil barang: ${materialList}`,
                    oldStatus: workOrder.status,
                    newStatus: workOrder.status
                }
            })

            return createdItems
        })

        return NextResponse.json({ success: true, items: results })
    } catch (error: any) {
        console.error('Error adding materials to work order:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
