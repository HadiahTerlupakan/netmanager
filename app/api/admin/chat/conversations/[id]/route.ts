import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { NextRequest } from 'next/server'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * Validation schema for sending message
 */
const sendMessageSchema = z.object({
    content: z.string().max(5000).optional(),
    imageUrl: z.string().url().optional(),
}).refine(data => data.content?.trim() || data.imageUrl, {
    message: 'Pesan atau gambar wajib diisi',
})

// GET - Get messages for a conversation
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('chat:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat chat')
        }

        const { id: conversationId } = await params
        const { searchParams } = new URL(request.url)
        const cursor = searchParams.get('cursor') || undefined
        const limit = parseInt(searchParams.get('limit') || '50')

        const chatService = new ChatService()
        const result = await chatService.getMessages(conversationId, user.id, cursor, limit)

        return apiSuccess(result)
    } catch (error: unknown) {
        console.error('Error fetching messages:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        
        if (message === 'Not a participant') {
            return ApiErrors.forbidden('Anda bukan peserta percakapan ini')
        }
        
        return ApiErrors.internalError('Gagal mengambil pesan')
    }
}

// POST - Send a message
export async function POST(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('chat:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengirim pesan')
        }

        const { id: conversationId } = await params
        const body = await request.json()
        
        const parseResult = sendMessageSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { content, imageUrl } = parseResult.data

        const chatService = new ChatService()
        const result = await chatService.sendMessage({
            conversationId,
            senderId: user.id,
            senderName: user.name || 'Admin',
            ...(content !== undefined ? { content } : {}),
            ...(imageUrl !== undefined ? { imageUrl } : {})
        })

        return apiSuccess(result, { status: 201, message: 'Pesan berhasil dikirim' })
    } catch (error: unknown) {
        console.error('Error sending message:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        
        if (message === 'Not a participant') {
            return ApiErrors.forbidden('Anda bukan peserta percakapan ini')
        }
        
        return ApiErrors.internalError('Gagal mengirim pesan')
    }
}
