import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// GET - List available work orders (PENDING status, not assigned)
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workOrders = await prisma.workOrders.findMany({
            where: {
                status: 'PENDING',
                assignedToId: null
            },
            include: {
                pelanggan: {
                    select: { nama: true }
                }
            },
            orderBy: [
                { priority: 'desc' },
                { scheduledDate: 'asc' },
                { createdAt: 'desc' }
            ],
            take: 50
        })

        return NextResponse.json({ workOrders })
    } catch (error) {
        console.error('Error fetching work orders:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Take a work order (assign to self)
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { workOrderId } = body

        if (!workOrderId) {
            return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 })
        }

        // Check if work order exists and is available
        const workOrder = await prisma.workOrders.findUnique({
            where: { id: workOrderId }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.status !== 'PENDING') {
            return NextResponse.json({ error: 'Work order sudah tidak tersedia' }, { status: 400 })
        }

        if (workOrder.assignedToId) {
            return NextResponse.json({ error: 'Work order sudah diambil orang lain' }, { status: 400 })
        }

        // Assign work order to user
        const updatedWorkOrder = await prisma.workOrders.update({
            where: { id: workOrderId },
            data: {
                assignedToId: session.user.id,
                status: 'ASSIGNED',
                scheduledDate: new Date(),
                scheduledTimeStart: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
            }
        })

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: session.user.id,
                details: { id: workOrderId, action: 'ASSIGN_SELF', status: 'ASSIGNED' }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        // Create update log
        await prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId,
                createdById: session.user.id,
                updateType: 'STATUS_CHANGE',
                message: 'Tiket diambil',
                oldStatus: 'PENDING',
                newStatus: 'ASSIGNED'
            }
        })

        return NextResponse.json({ success: true, workOrder: updatedWorkOrder })
    } catch (error) {
        console.error('Error taking work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
