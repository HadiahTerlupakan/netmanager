import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { randomUUID } from 'crypto'
import { notifyAdminsAboutMobileAction } from '@/modules/notification'
import { apiError, ErrorCodes } from '@/lib/api-response'

interface UsedMaterial {
    id: string;
    nama: string;
    jumlah: number;
    satuan: string;
    kondisi: string;
    barangId: string;
    gudangId: string;
}

// POST - Add materials/barang to work order (creates barang keluar)
export async function POST(
    req: NextRequest,
    params: { params: Promise<{ id: string }> } // Correct params type for Next.js 15
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

        if (!['ASSIGNED', 'IN_PROGRESS'].includes(workOrder.status)) {
            return apiError('Work order harus dalam status ASSIGNED atau IN_PROGRESS', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Process each item - create barang keluar and update stock
        const results = await prisma.$transaction(async (tx) => {
            const createdItems = []

            for (const item of items) {
                const { barangId, gudangId, jumlah, kondisi } = item
                const jumlahInt = Math.floor(jumlah)
                const itemKondisi = kondisi || 'BARU'

                if (jumlahInt <= 0) {
                    throw new Error('Jumlah harus angka bulat positif')
                }

                // Check stock specifically for the condition
                const barangGudang = await tx.barangGudang.findFirst({
                    where: {
                        barangId,
                        gudangId,
                        tenantId
                    },
                    include: { barang: true }
                })

                if (!barangGudang) {
                    throw new Error('Data stok tidak ditemukan di gudang ini')
                }

                // Determine which stock field to check
                let availableStock = 0
                if (itemKondisi === 'BARU') availableStock = barangGudang.stokBaru
                else if (itemKondisi === 'BEKAS') availableStock = barangGudang.stokBekas
                else if (itemKondisi === 'RUSAK') availableStock = barangGudang.stokRusak
                else availableStock = barangGudang.stok // Fallback

                if (availableStock < jumlahInt) {
                    throw new Error(`Stok ${itemKondisi} tidak mencukupi untuk barang ${barangGudang.barang.nama}. Tersedia: ${availableStock}`)
                }

                // Create barang keluar
                const keluar = await tx.barangKeluar.create({
                    data: {
                        id: randomUUID(),
                        barangId,
                        gudangId,
                        jumlah: jumlahInt,
                        kondisi: itemKondisi,
                        userId: userId,
                        purpose: `Work Order: ${workOrder.workOrderNumber}`,
                        keterangan: `Digunakan untuk work order ${workOrder.workOrderNumber} - ${workOrder.title}`,
                        tenantId
                    },
                    include: { barang: true }
                })

                // Update stock - precisely for the condition and total
                const updateData: Prisma.BarangGudangUpdateInput = {
                    stok: { decrement: jumlahInt }
                }
                
                if (itemKondisi === 'BARU') updateData.stokBaru = { decrement: jumlahInt }
                else if (itemKondisi === 'BEKAS') updateData.stokBekas = { decrement: jumlahInt }
                else if (itemKondisi === 'RUSAK') updateData.stokRusak = { decrement: jumlahInt }

                await tx.barangGudang.update({
                    where: { id: barangGudang.id },
                    data: updateData
                })


                createdItems.push({
                    id: keluar.id,
                    nama: keluar.barang.nama,
                    jumlah: jumlahInt,
                    satuan: keluar.barang.satuan,
                    kondisi: itemKondisi,
                    barangId,
                    gudangId
                })
            }

            // Update work order usedMaterials
            const existingMaterials = (workOrder.usedMaterials as unknown as UsedMaterial[]) || []
            await tx.workOrders.update({
                where: { id, tenantId },
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
                    newStatus: workOrder.status,
                    tenantId
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
            ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
            ...(workOrder.siteId && { siteId: workOrder.siteId }),
        })

        return NextResponse.json({ success: true, items: results })
    } catch (error) {
        console.error('Error adding materials to work order (mobile):', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Terjadi kesalahan server'
        }, { status: 500 })
    }
}
