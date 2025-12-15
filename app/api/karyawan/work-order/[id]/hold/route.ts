import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Hold work order
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
        const { reason } = body

        // Get work order
        const workOrder = await prisma.workOrder.findUnique({
            where: { id },
            select: { status: true, assignedToId: true }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        // Validate status
        if (workOrder.status !== 'IN_PROGRESS') {
            return NextResponse.json({ error: 'Hanya work order yang sedang dikerjakan bisa di-hold' }, { status: 400 })
        }

        // Validate assignment
        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses ke work order ini' }, { status: 403 })
        }

        // Update status and create log
        await prisma.$transaction([
            prisma.workOrder.update({
                where: { id },
                data: { status: 'ON_HOLD' }
            }),
            prisma.workOrderUpdate.create({
                data: {
                    workOrderId: id,
                    updateType: 'STATUS_CHANGE',
                    message: reason || 'Work order di-hold',
                    oldStatus: 'IN_PROGRESS',
                    newStatus: 'ON_HOLD',
                    createdById: session.user.id
                }
            })
        ])

        return NextResponse.json({ success: true, message: 'Work order berhasil di-hold' })
    } catch (error) {
        console.error('Error holding work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
