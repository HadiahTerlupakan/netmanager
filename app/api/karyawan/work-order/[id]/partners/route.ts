import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        const body = await req.json().catch(() => ({}))
        const { partnerIds } = body

        if (!Array.isArray(partnerIds)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        const workOrder = await prisma.workOrder.findUnique({
            where: { id }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        // Validate partners match site/dept requirements
        if (partnerIds.length > 0) {
            const count = await prisma.user.count({
                where: {
                    id: { in: partnerIds },
                    siteId: workOrder.siteId,
                    // departmentId: workOrder.departmentId, // Allow cross-department partners
                    isActive: true
                }
            })

            if (count !== partnerIds.length) {
                return NextResponse.json({ error: 'Beberapa partner tidak valid (beda site/departemen)' }, { status: 400 })
            }
        }

        // Identify new partners to notify
        const existingAssignments = await prisma.workOrderAssignment.findMany({
            where: {
                workOrderId: id,
                role: 'PARTNER'
            },
            select: { userId: true }
        })
        const existingPartnerIds = new Set(existingAssignments.map(a => a.userId))
        const newPartnerIds = partnerIds.filter((pid: string) => !existingPartnerIds.has(pid))

        await prisma.$transaction(async (tx) => {
            // Remove existing partners
            await tx.workOrderAssignment.deleteMany({
                where: {
                    workOrderId: id,
                    role: 'PARTNER'
                }
            })

            // Add new partners
            if (partnerIds.length > 0) {
                await tx.workOrderAssignment.createMany({
                    data: partnerIds.map((userId: string) => ({
                        workOrderId: id,
                        userId: userId,
                        role: 'PARTNER',
                        assignedById: session.user.id
                    }))
                })
            }

            // Create Notifications for NEW partners
            if (newPartnerIds.length > 0) {
                await tx.notification.createMany({
                    data: newPartnerIds.map((userId: string) => ({
                        userId,
                        type: 'WORK_ORDER',
                        title: 'Partner Kerja Baru',
                        message: `Anda telah ditambahkan sebagai partner kerja di Work Order #${workOrder.workOrderNumber || id.substring(0, 8)}`,
                        link: `/karyawan/work-order/${id}`,
                        sourceType: 'WORK_ORDER',
                        sourceId: id,
                        createdAt: new Date()
                    }))
                })
            }

            // Log update
            await tx.workOrderUpdate.create({
                data: {
                    workOrderId: id,
                    createdById: session.user.id,
                    updateType: 'PARTNER_UPDATE',
                    message: partnerIds.length > 0
                        ? `Mengupdate partner kerja (${partnerIds.length} orang)`
                        : 'Menghapus semua partner kerja',
                    oldStatus: workOrder.status,
                    newStatus: workOrder.status
                }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error saving partners:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
