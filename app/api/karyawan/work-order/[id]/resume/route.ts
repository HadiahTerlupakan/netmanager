import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        const workOrder = await prisma.workOrder.findUnique({
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

        // Update status and create log
        await prisma.$transaction([
            prisma.workOrder.update({
                where: { id },
                data: { status: 'IN_PROGRESS' }
            }),
            prisma.workOrderUpdate.create({
                data: {
                    workOrderId: id,
                    updateType: 'STATUS_CHANGE',
                    message: 'Melanjutkan pekerjaan',
                    oldStatus: 'ON_HOLD',
                    newStatus: 'IN_PROGRESS',
                    createdById: session.user.id
                }
            })
        ])

        return NextResponse.json({ success: true, message: 'Work order dilanjutkan' })
    } catch (error) {
        console.error('Error resuming work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
