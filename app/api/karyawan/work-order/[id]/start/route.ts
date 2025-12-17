import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Start working on work order
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

        const workOrder = await prisma.workOrder.findUnique({
            where: { id }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        if (workOrder.status !== 'ASSIGNED') {
            return NextResponse.json({ error: 'Work order tidak dalam status ASSIGNED' }, { status: 400 })
        }

        // Update status to IN_PROGRESS
        const updated = await prisma.workOrder.update({
            where: { id },
            data: {
                status: 'IN_PROGRESS',
                startedAt: new Date()
            }
        })

        // Create update log
        await prisma.workOrderUpdate.create({
            data: {
                workOrderId: id,
                createdById: session.user.id,
                updateType: 'STATUS_CHANGE',
                message: 'Mulai mengerjakan',
                oldStatus: 'ASSIGNED',
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
                details: { id, action: 'START_WORK', status: 'IN_PROGRESS' }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({ success: true, workOrder: updated })
    } catch (error) {
        console.error('Error starting work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
