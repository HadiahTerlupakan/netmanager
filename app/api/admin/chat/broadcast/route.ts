import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { NextRequest } from 'next/server'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Validation schema for broadcast message
 */
const broadcastSchema = z.object({
    content: z.string().min(1, 'Konten pesan wajib diisi').max(5000),
    title: z.string().max(200).optional(),
})

// POST - Send broadcast message to all users
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Check broadcast permission
        if (!await hasPermission('broadcast:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk broadcast')
        }

        const body = await request.json()
        const parseResult = broadcastSchema.safeParse(body)
        
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { content, title } = parseResult.data

        const chatService = new ChatService()
        const result = await chatService.broadcastMessage({
            senderId: user.id,
            senderName: user.name || 'Admin',
            content: content.trim(),
            ...(title ? { title } : {})
        })

        return apiSuccess(result, { status: 201, message: 'Broadcast berhasil dikirim' })
    } catch (error: unknown) {
        console.error('Error broadcasting message:', error)
        return ApiErrors.internalError('Gagal mengirim broadcast')
    }
}
