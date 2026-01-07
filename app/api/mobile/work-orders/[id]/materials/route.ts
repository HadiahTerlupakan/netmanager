import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { randomUUID } from 'crypto'
import { notifyAdminsAboutMobileAction } from '@/modules/notification'

// POST - Add materials/barang to work order (creates barang keluar)
export async function POST(
    req: NextRequest,
    params: { params: Promise<{ id: string }> } // Correct params type for Next.js 15
) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = await verifyMobileToken(token)

        if (!decoded || !decoded.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const userId = decoded.id as string

        // Fetch user to get name (for accurate notifications)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        })

        const { id } = await params.params
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

        if (workOrder.assignedToId !== userId) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        if (!['ASSIGNED', 'IN_PROGRESS'].includes(workOrder.status)) {
            return NextResponse.json({ error: 'Work order harus dalam status ASSIGNED atau IN_PROGRESS' }, { status: 400 })
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
                        userId: userId,
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

                // Specific condition stock update
                const updateData: any = {}
                if (kondisi === 'BARU') updateData.stokBaru = { decrement: jumlah }
                else if (kondisi === 'BEKAS') updateData.stokBekas = { decrement: jumlah }
                else if (kondisi === 'RUSAK') updateData.stokRusak = { decrement: jumlah }

                if (Object.keys(updateData).length > 0) {
                    await tx.barangGudang.update({
                        where: {
                            barangId_gudangId: { barangId, gudangId }
                        },
                        data: updateData
                    })
                }


                createdItems.push({
                    id: keluar.id,
                    nama: keluar.barang.nama,
                    jumlah,
                    satuan: keluar.barang.satuan,
                    kondisi: kondisi || 'BARU',
                    barangId,
                    gudangId
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
                    createdById: userId,
                    updateType: 'MATERIAL_PICKUP',
                    message: `Mengambil barang: ${materialList}`,
                    oldStatus: workOrder.status,
                    newStatus: workOrder.status
                }
            })

            return createdItems
        })

        // Notify Admin Portal about material pickup
        const materialList = results.map(m => `${m.nama} (${m.jumlah})`).join(', ')
        await notifyAdminsAboutMobileAction({
            workOrderId: id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            actionType: 'MATERIAL_PICKUP',
            actionMessage: `Mengambil barang: ${materialList}`,
            triggeredByUserId: userId,
            triggeredByName: (user?.name as string) || (decoded.name as string),
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
        })

        return NextResponse.json({ success: true, items: results })
    } catch (error: any) {
        console.error('Error adding materials to work order (mobile):', error)
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
