import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// POST - Resume work order from hold
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

        // Get work order
        const workOrder = await prisma.workOrders.findUnique({
            where: { id },
            select: { status: true, assignedToId: true }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        // Validate status
        if (workOrder.status !== 'ON_HOLD') {
            return NextResponse.json({ error: 'Work order tidak sedang di-hold' }, { status: 400 })
        }

        // Validate assignment
        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses ke work order ini' }, { status: 403 })
        }

        // Update status
        const updated = await prisma.workOrders.update({
            where: { id },
            data: { status: 'IN_PROGRESS' }
        })

        // Create update log
        await prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId: id,
                createdById: session.user.id,
                updateType: 'STATUS_CHANGE',
                message: 'Melanjutkan pekerjaan',
                oldStatus: 'ON_HOLD',
                newStatus: 'IN_PROGRESS'
            }
        })

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: session.user.id,
                details: { id, action: 'RESUME_WORK', status: 'IN_PROGRESS' }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({ success: true, workOrder: updated })
    } catch (error) {
        console.error('Error resuming work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
