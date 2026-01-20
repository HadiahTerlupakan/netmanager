import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { randomUUID } from 'crypto'
import { notifyAdminsAboutMobileAction } from '@/modules/notification'
import { logger } from '@/lib/logger'

// POST - Return materials to warehouse (creates barang masuk) for DISCONNECTION work orders
export async function POST(
    req: NextRequest,
    params: { params: Promise<{ id: string }> }
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

        // Allow material return for DISCONNECTION and RELOCATION types
        // Also allow for any work order that is IN_PROGRESS or COMPLETED (for flexibility)
        if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(workOrder.status)) {
            return NextResponse.json({ 
                error: 'Work order harus dalam status ASSIGNED, IN_PROGRESS, atau COMPLETED untuk mengembalikan barang' 
            }, { status: 400 })
        }

        // Process each item - create barang masuk and update stock
        const results = await prisma.$transaction(async (tx) => {
            const createdItems = []

            for (const item of items) {
                const { barangId, gudangId, jumlah, kondisi } = item

                // Validate kondisi
                const validKondisi = ['BARU', 'BEKAS', 'RUSAK']
                if (!validKondisi.includes(kondisi)) {
                    throw new Error(`Kondisi tidak valid: ${kondisi}. Harus salah satu dari: ${validKondisi.join(', ')}`)
                }

                // Fetch barang info
                const barang = await tx.barang.findUnique({
                    where: { id: barangId }
                })

                if (!barang) {
                    throw new Error(`Barang dengan ID ${barangId} tidak ditemukan`)
                }

                // Create barang masuk
                const masuk = await tx.barangMasuk.create({
                    data: {
                        id: randomUUID(),
                        barangId,
                        gudangId,
                        jumlah,
                        kondisi: kondisi || 'BEKAS',
                        userId: userId,
                        keterangan: `Pengembalian dari Work Order ${workOrder.workOrderNumber} - ${workOrder.title}`
                    },
                    include: { barang: true }
                })

                // Update or create stock in gudang
                const existingStock = await tx.barangGudang.findUnique({
                    where: {
                        barangId_gudangId: { barangId, gudangId }
                    }
                })

                if (existingStock) {
                    // Update existing stock
                    const updateData: any = {
                        stok: { increment: jumlah }
                    }
                    
                    // Update specific condition stock
                    if (kondisi === 'BARU') updateData.stokBaru = { increment: jumlah }
                    else if (kondisi === 'BEKAS') updateData.stokBekas = { increment: jumlah }
                    else if (kondisi === 'RUSAK') updateData.stokRusak = { increment: jumlah }

                    await tx.barangGudang.update({
                        where: {
                            barangId_gudangId: { barangId, gudangId }
                        },
                        data: updateData
                    })
                } else {
                    // Create new stock record
                    const createData: any = {
                        id: randomUUID(),
                        barangId,
                        gudangId,
                        stok: jumlah,
                        stokBaru: kondisi === 'BARU' ? jumlah : 0,
                        stokBekas: kondisi === 'BEKAS' ? jumlah : 0,
                        stokRusak: kondisi === 'RUSAK' ? jumlah : 0
                    }

                    await tx.barangGudang.create({
                        data: createData
                    })
                }

                createdItems.push({
                    id: masuk.id,
                    nama: masuk.barang.nama,
                    jumlah,
                    satuan: masuk.barang.satuan,
                    kondisi: kondisi || 'BEKAS',
                    barangId,
                    gudangId
                })
            }

            // Update work order returnedMaterials
            const existingReturned = (workOrder.returnedMaterials as any[]) || []
            await tx.workOrders.update({
                where: { id },
                data: {
                    returnedMaterials: [...existingReturned, ...createdItems]
                }
            })

            // Log to Activity Timeline
            const materialList = createdItems.map(m => `${m.nama} - ${m.kondisi} (${m.jumlah} ${m.satuan})`).join(', ')
            await tx.workOrderUpdates.create({
                data: {
                    id: randomUUID(),
                    workOrderId: id,
                    createdById: userId,
                    updateType: 'MATERIAL_RETURN',
                    message: `Mengembalikan barang: ${materialList}`,
                    oldStatus: workOrder.status,
                    newStatus: workOrder.status
                }
            })

            return createdItems
        })

        // Notify Admin Portal about material return
        const materialList = results.map(m => `${m.nama} (${m.jumlah})`).join(', ')
        await notifyAdminsAboutMobileAction({
            workOrderId: id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            actionType: 'MATERIAL_RETURN',
            actionMessage: `Mengembalikan barang: ${materialList}`,
            triggeredByUserId: userId,
            triggeredByName: (user?.name as string) || (decoded.name as string),
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
        })

        // System Log
        await logger.logActivity({
            action: 'CREATE',
            subject: 'MaterialReturn',
            userId,
            details: { 
                workOrderId: id, 
                workOrderNumber: workOrder.workOrderNumber,
                items: results 
            }
        })

        return NextResponse.json({ success: true, items: results })
    } catch (error: any) {
        console.error('Error returning materials from work order (mobile):', error)
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
