import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// POST - Complete work order
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
        const { resolutionNotes, photos } = body

        // Get work order
        const workOrder = await prisma.workOrders.findUnique({
            where: { id },
            select: { status: true, assignedToId: true }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        // Validate status
        if (workOrder.status !== 'IN_PROGRESS' && workOrder.status !== 'ON_HOLD') {
            return NextResponse.json({ error: 'Work order tidak bisa diselesaikan' }, { status: 400 })
        }

        // Validate assignment
        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses ke work order ini' }, { status: 403 })
        }

        // Build message with photo info
        let message = 'Work order diselesaikan'
        if (resolutionNotes) {
            message += `: ${resolutionNotes}`
        }
        if (photos && photos.length > 0) {
            message += ` (${photos.length} foto terlampir)`
        }

        // Update work order and create log
        await prisma.$transaction([
            prisma.workOrders.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    resolutionNotes: resolutionNotes || null
                }
            }),
            prisma.workOrderUpdates.create({
                data: {
                    id: randomUUID(),
                    workOrderId: id,
                    updateType: 'COMPLETION',
                    message: message,
                    oldStatus: workOrder.status,
                    newStatus: 'COMPLETED',
                    createdById: session.user.id
                }
            }),
            // Save photos as attachments if any
            ...(photos && photos.length > 0 ? photos.map((url: string) =>
                prisma.workOrderAttachments.create({
                    data: {
                        id: randomUUID(),
                        workOrderId: id,
                        fileName: url.split('/').pop() || 'photo.jpg',
                        filePath: url,
                        fileSize: 0, // Should be calculated or passed
                        fileType: 'image/jpeg', // Defaulting to jpeg for now since type is lost
                        caption: '[COMPLETION] Bukti Penyelesaian',
                        uploadedById: session.user.id
                    }
                })
            ) : [])
        ])

        return NextResponse.json({ success: true, message: 'Work order berhasil diselesaikan' })
    } catch (error) {
        console.error('Error completing work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
