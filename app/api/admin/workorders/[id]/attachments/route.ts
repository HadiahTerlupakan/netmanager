import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

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
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah attachment')
        }

        const { id } = await params
        const body = await request.json()
        const { fileName, filePath, fileType, caption, fileSize } = body

        if (!fileName || !filePath || !fileType) {
            return apiError('fileName, filePath, dan fileType wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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

        return apiSuccess({
            ...attachment,
            uploadedBy: attachment.user
        }, { message: 'Attachment berhasil ditambahkan' })

    } catch (error) {
        console.error('Error adding attachment:', error)
        return ApiErrors.internalError('Gagal menambah attachment')
    }
}
