import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// POST - Toggle task status
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
        const { taskId } = body

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }

        // Get work order and task
        const workOrder = await prisma.workOrders.findUnique({
            where: { id },
            select: { status: true, assignedToId: true }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        // Validate assignment
        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses' }, { status: 403 })
        }

        // Validate status - only allow when IN_PROGRESS
        if (workOrder.status !== 'IN_PROGRESS') {
            return NextResponse.json({ error: 'Work order harus sedang dikerjakan' }, { status: 400 })
        }

        // Get task
        const task = await prisma.workOrderTasks.findUnique({
            where: { id: taskId }
        })

        if (!task || task.workOrderId !== id) {
            return NextResponse.json({ error: 'Task tidak ditemukan' }, { status: 404 })
        }

        // Karyawan only allowed to complete tasks, not uncomplete them
        if (task.status === 'COMPLETED') {
            return NextResponse.json({
                error: 'Task yang sudah selesai hanya bisa dibatalkan oleh admin'
            }, { status: 400 })
        }

        // Set status to COMPLETED (one-way from karyawan portal)
        const updatedTask = await prisma.workOrderTasks.update({
            where: { id: taskId },
            data: {
                status: 'COMPLETED',
                completedById: session.user.id,
                completedAt: new Date()
            }
        })

        // Log update
        await prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId: id,
                updateType: 'TASK_UPDATE',
                message: `Menyelesaikan task: ${task.title}`,
                createdById: session.user.id
            }
        })

        return NextResponse.json({ success: true, task: updatedTask })
    } catch (error) {
        console.error('Error toggling task:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
