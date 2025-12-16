import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { socketEmitter } from '@/lib/websocket/emitter'

// POST - Add update/comment to work order with optional photos
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
        const { message, photos } = body

        if ((!message || message.trim().length === 0) && (!photos || photos.length === 0)) {
            return NextResponse.json({ error: 'Pesan atau foto diperlukan' }, { status: 400 })
        }

        // Get work order
        const workOrder = await prisma.workOrder.findUnique({
            where: { id },
            select: { assignedToId: true }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        // Validate assignment
        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Anda tidak memiliki akses' }, { status: 403 })
        }

        // Build message
        let updateMessage = message?.trim() || ''
        if (photos && photos.length > 0) {
            if (updateMessage) {
                updateMessage += ` (${photos.length} foto)`
            } else {
                updateMessage = `Menambahkan ${photos.length} foto`
            }
        }

        // Create update with photos stored in message as JSON if photos exist
        const updateData: any = {
            workOrderId: id,
            updateType: photos && photos.length > 0 ? 'PHOTO_UPDATE' : 'COMMENT',
            message: updateMessage,
            createdById: session.user.id
        }

        const update = await prisma.workOrderUpdate.create({
            data: updateData,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        })

        // Save photos as attachments if any
        if (photos && photos.length > 0) {
            await prisma.$transaction(
                photos.map((url: string) =>
                    prisma.workOrderAttachment.create({
                        data: {
                            workOrderId: id,
                            fileName: url.split('/').pop() || 'photo.jpg',
                            filePath: url,
                            fileSize: 0,
                            fileType: 'image/jpeg',
                            uploadedById: session.user.id
                        }
                    })
                )
            )
        }

        // Emit WebSocket event for real-time Activity Timeline
        socketEmitter.workOrderActivity(id, {
            id: update.id,
            type: photos && photos.length > 0 ? 'attachment' : 'comment',
            message: update.message,
            updateType: update.updateType,
            createdAt: update.createdAt.toISOString(),
            createdBy: update.createdBy ? {
                id: update.createdBy.id,
                name: update.createdBy.name || undefined,
            } : null,
        })

        return NextResponse.json({
            success: true,
            update: {
                ...update,
                photos: photos || []
            }
        })
    } catch (error) {
        console.error('Error adding update:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
