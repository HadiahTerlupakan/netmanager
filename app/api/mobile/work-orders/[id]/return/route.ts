import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/database'
import { Prisma } from '@prisma/client'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { randomUUID } from 'crypto'
import { notifyAdminsAboutMobileAction } from '@/modules/notification'
import { logger } from '@/lib/logger'
import { apiError, ErrorCodes } from '@/lib/api-response'

interface ReturnedMaterial {
    id: string;
    nama: string;
    jumlah: number;
    satuan: string;
    kondisi: string;
    barangId: string;
    gudangId: string;
}

// POST - Return materials to warehouse (creates barang masuk) for DISCONNECTION work orders
export async function POST(
    req: NextRequest,
    params: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const decoded = authResult
        const userId = decoded.id as string
        const tenantId = decoded.tenantId as string

        // Fetch user to get name (for accurate notifications)
        const user = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: { name: true }
        })

        const { id } = await params.params
        const body = await req.json()
        const { items } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return apiError('Items wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const workOrder = await prisma.workOrders.findFirst({
            where: { id, tenantId },
            include: {
                assignments: { select: { userId: true, status: true } }
            }
        })

        if (!workOrder) {
            return apiError('Work order tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        // Check if user is authorized (lead technician OR approved partner)
        const isAssignedTo = workOrder.assignedToId === userId
        const isApprovedPartner = workOrder.assignments.some(
            (a) => a.userId === userId && a.status === 'APPROVED'
        )

        if (!isAssignedTo && !isApprovedPartner) {
            return apiError('Anda tidak memiliki akses ke work order ini. Hanya lead teknisi dan partner yang disetujui.', ErrorCodes.FORBIDDEN, { status: 403 })
        }

        // Allow material return for DISCONNECTION and RELOCATION types
        // Also allow for any work order that is IN_PROGRESS or COMPLETED (for flexibility)
        if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(workOrder.status)) {
            return apiError('Work order harus dalam status ASSIGNED, IN_PROGRESS, atau COMPLETED untuk mengembalikan barang', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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
                const barang = await tx.barang.findFirst({
                    where: { id: barangId, tenantId }
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
                        keterangan: `Pengembalian dari Work Order ${workOrder.workOrderNumber} - ${workOrder.title}`,
                        tenantId
                    },
                    include: { barang: true }
                })

                // Update or create stock in gudang
                const existingStock = await tx.barangGudang.findFirst({
                    where: {
                        barangId,
                        gudangId,
                        tenantId
                    }
                })

                if (existingStock) {
                    // Update existing stock
                    const updateData: Prisma.BarangGudangUpdateInput = {
                        stok: { increment: jumlah }
                    }
                    
                    // Update specific condition stock
                    if (kondisi === 'BARU') updateData.stokBaru = { increment: jumlah }
                    else if (kondisi === 'BEKAS') updateData.stokBekas = { increment: jumlah }
                    else if (kondisi === 'RUSAK') updateData.stokRusak = { increment: jumlah }

                    await tx.barangGudang.update({
                        where: { id: existingStock.id },
                        data: updateData
                    })
                } else {
                    // Create new stock record
                    await tx.barangGudang.create({
                        data: {
                            id: randomUUID(),
                            barangId,
                            gudangId,
                            stok: jumlah,
                            stokBaru: kondisi === 'BARU' ? jumlah : 0,
                            stokBekas: kondisi === 'BEKAS' ? jumlah : 0,
                            stokRusak: kondisi === 'RUSAK' ? jumlah : 0,
                            updatedAt: new Date(),
                            tenantId
                        }
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
            const existingReturned = (workOrder.returnedMaterials as unknown as ReturnedMaterial[]) || []
            await tx.workOrders.update({
                where: { id, tenantId },
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
                    newStatus: workOrder.status,
                    tenantId
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
            ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
            ...(workOrder.siteId && { siteId: workOrder.siteId }),
        })

        // System Log
        await logger.logActivity({
            action: 'CREATE',
            subject: 'MaterialReturn',
            userId,
            tenantId,
            details: { 
                workOrderId: id, 
                workOrderNumber: workOrder.workOrderNumber,
                items: results 
            }
        })

        return NextResponse.json({ success: true, items: results })
    } catch (error) {
        console.error('Error returning materials from work order (mobile):', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Terjadi kesalahan server'
        }, { status: 500 })
    }
}
