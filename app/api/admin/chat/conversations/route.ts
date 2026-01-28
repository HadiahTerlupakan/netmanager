import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { NextRequest } from 'next/server'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Validation schema for creating conversation
 */
const createConversationSchema = z.object({
    participantIds: z.array(z.string().uuid()).min(1, 'Minimal 1 peserta'),
    name: z.string().max(100).optional(),
})

// GET - Get all conversations for current admin user
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const chatService = new ChatService()
        const conversations = await chatService.getConversations(user.id)

        return apiSuccess(conversations)
    } catch (error: unknown) {
        console.error('Error fetching conversations:', error)
        return ApiErrors.internalError('Gagal mengambil percakapan')
    }
}

// POST - Create a new conversation
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Check permission
        if (!await hasPermission('chat:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat percakapan')
        }

        const body = await request.json()
        const parseResult = createConversationSchema.safeParse(body)
        
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { participantIds, name } = parseResult.data

        const chatService = new ChatService()
        const result = await chatService.createConversation({
            creatorId: user.id,
            participantIds,
            name
        })

        return apiSuccess(result, { status: 201, message: 'Percakapan berhasil dibuat' })
    } catch (error: unknown) {
        console.error('Error creating conversation:', error)
        return ApiErrors.internalError('Gagal membuat percakapan')
    }
}
