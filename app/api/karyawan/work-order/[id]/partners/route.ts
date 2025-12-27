import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

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

        const workOrder = await prisma.workOrders.findUnique({
            where: { id }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        // Validate partners exist (no site restriction)
        if (partnerIds.length > 0) {
            const validPartners = await prisma.user.findMany({
                where: {
                    id: { in: partnerIds },
                    isActive: true
                },
                select: { id: true, name: true }
            })

            if (validPartners.length !== partnerIds.length) {
                // Identify incorrect partners
                const validIds = new Set(validPartners.map(p => p.id))
                const invalidIds = partnerIds.filter((id: string) => !validIds.has(id))

                return NextResponse.json({
                    error: `Beberapa ID partner tidak ditemukan atau tidak aktif: ${invalidIds.join(', ')}`,
                }, { status: 400 })
            }
        }

        // Identify new partners to notify
        const existingAssignments = await prisma.workOrderAssignments.findMany({
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
            await tx.workOrderAssignments.deleteMany({
                where: {
                    workOrderId: id,
                    role: 'PARTNER'
                }
            })

            // Add new partners with PENDING status
            if (partnerIds.length > 0) {
                await tx.workOrderAssignments.createMany({
                    data: partnerIds.map((userId: string) => ({
                        id: randomUUID(),
                        workOrderId: id,
                        userId: userId,
                        role: 'PARTNER',
                        status: 'PENDING',
                        assignedById: session.user.id
                    }))
                })
            }

            // Create Notifications for NEW partners (with approval request)
            if (newPartnerIds.length > 0) {
                await tx.notifications.createMany({
                    data: newPartnerIds.map((userId: string) => ({
                        id: randomUUID(),
                        userId,
                        type: 'PARTNER_REQUEST',
                        title: 'Permintaan Partner Kerja',
                        message: `Anda diminta menjadi partner kerja di Work Order #${workOrder.workOrderNumber || id.substring(0, 8)}. Silakan berikan tanggapan.`,
                        link: `/karyawan/work-order/${id}`,
                        sourceType: 'WORK_ORDER',
                        sourceId: id,
                        createdAt: new Date()
                    }))
                })
            }

            // Log update
            await tx.workOrderUpdates.create({
                data: {
                    id: randomUUID(),
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
