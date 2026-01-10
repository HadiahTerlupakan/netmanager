
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request)
        if (user instanceof NextResponse) {
            return user
        }

        // Permission check (Update permission required to add attachments)
        if (!await hasPermission('list:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { fileName, filePath, fileType, caption, fileSize } = body

        if (!fileName || !filePath || !fileType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const attachment = await prisma.workOrderAttachments.create({
            data: {
                id: crypto.randomUUID(),
                workOrderId: id,
                fileName,
                filePath,
                fileType,
                fileSize: fileSize || 0,
                caption,
                uploadedAt: new Date(),
                uploadedById: user.id
            },
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            }
        })

        // Log Activity
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: user.id,
                details: { 
                    workOrderId: id, 
                    type: 'ATTACHMENT_UPLOAD',
                    fileName 
                }
            })
        } catch (e) {
            console.error('Log failed', e)
        }

        return NextResponse.json({
            success: true,
            data: {
                ...attachment,
                uploadedBy: attachment.user
            }
        })

    } catch (error) {
        console.error('Error adding attachment:', error)
        return NextResponse.json({ error: 'Failed to add attachment' }, { status: 500 })
    }
}
