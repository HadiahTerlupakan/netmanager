import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// POST - Partner responds to work order invitation (APPROVE/REJECT)
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
        const { response } = body // 'APPROVED' or 'REJECTED'

        if (!response || !['APPROVED', 'REJECTED'].includes(response)) {
            return NextResponse.json({ error: 'Invalid response. Must be APPROVED or REJECTED' }, { status: 400 })
        }

        // Find the assignment for this user
        const assignment = await prisma.workOrderAssignments.findFirst({
            where: {
                workOrderId: id,
                userId: session.user.id,
                role: 'PARTNER'
            },
            include: {
                workOrders: {
                    select: {
                        workOrderNumber: true,
                        assignedToId: true
                    }
                }
            }
        })

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
        }

        if (assignment.status !== 'PENDING') {
            return NextResponse.json({ error: 'Already responded to this request' }, { status: 400 })
        }

        // Update assignment status
        await prisma.$transaction(async (tx) => {
            await tx.workOrderAssignments.update({
                where: { id: assignment.id },
                data: {
                    status: response,
                    respondedAt: new Date()
                }
            })

            // Notify the main assignee
            if (assignment.workOrders.assignedToId) {
                await tx.notifications.create({
                    data: {
                        id: randomUUID(),
                        userId: assignment.workOrders.assignedToId,
                        type: 'PARTNER_RESPONSE',
                        title: response === 'APPROVED' ? 'Partner Menyetujui' : 'Partner Menolak',
                        message: `${session.user.name || 'Partner'} ${response === 'APPROVED' ? 'menyetujui' : 'menolak'} permintaan partner di Work Order #${assignment.workOrders.workOrderNumber}`,
                        link: `/karyawan/work-order/${id}`,
                        sourceType: 'WORK_ORDER',
                        sourceId: id
                    }
                })
            }

            // Log update
            await tx.workOrderUpdates.create({
                data: {
                    id: randomUUID(),
                    workOrderId: id,
                    createdById: session.user.id,
                    updateType: 'PARTNER_RESPONSE',
                    message: `${session.user.name || 'Partner'} ${response === 'APPROVED' ? 'menyetujui' : 'menolak'} sebagai partner kerja`
                }
            })
        })

        return NextResponse.json({ success: true, status: response })
    } catch (error) {
        console.error('Error responding to partner request:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
