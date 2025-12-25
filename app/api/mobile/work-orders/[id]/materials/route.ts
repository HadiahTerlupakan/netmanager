import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'

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
        const { id } = await params.params
        const body = await req.json()
        const { items } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Items is required' }, { status: 400 })
        }

        const workOrder = await prisma.workOrder.findUnique({
            where: { id }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== userId) {
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
                    kondisi: kondisi || 'BARU'
                })
            }

            // Update work order usedMaterials
            const existingMaterials = (workOrder.usedMaterials as any[]) || []
            await tx.workOrder.update({
                where: { id },
                data: {
                    usedMaterials: [...existingMaterials, ...createdItems]
                }
            })

            // Log to Activity Timeline
            const materialList = createdItems.map(m => `${m.nama} - ${m.kondisi} (${m.jumlah} ${m.satuan})`).join(', ')
            await tx.workOrderUpdate.create({
                data: {
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

        return NextResponse.json({ success: true, items: results })
    } catch (error: any) {
        console.error('Error adding materials to work order (mobile):', error)
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
