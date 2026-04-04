import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'

const sendMessageSchema = z.object({
    content: z.string().max(5000).optional(),
    imageUrl: z.string().url().optional(),
}).refine(data => data.content?.trim() || data.imageUrl, {
    message: 'Pesan atau gambar wajib diisi',
})

// GET - Get messages for a conversation
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('chat:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat chat')
    }

    const { id: conversationId } = ctx.params
    const { searchParams } = req.nextUrl
    const cursor = searchParams.get('cursor') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    const chatService = new ChatService()
    try {
        const result = await chatService.getMessages(conversationId, ctx.session!.user.id, cursor, limit)
        return apiSuccess(result)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        if (message === 'Not a participant') {
            return ApiErrors.forbidden('Anda bukan peserta percakapan ini')
        }
        throw error
    }
})

// POST - Send a message
export const POST = createHandler({ 
    auth: true, 
    schema: sendMessageSchema 
}, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('chat:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengirim pesan')
    }

    const { id: conversationId } = ctx.params
    const { content, imageUrl } = ctx.validated

    const chatService = new ChatService()
    try {
        const result = await chatService.sendMessage({
            conversationId,
            senderId: user.id,
            senderName: user.name || 'Admin',
            ...(content !== undefined ? { content } : {}),
            ...(imageUrl !== undefined ? { imageUrl } : {})
        })

        return apiSuccess(result, { status: 201, message: 'Pesan berhasil dikirim' })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        if (message === 'Not a participant') {
            return ApiErrors.forbidden('Anda bukan peserta percakapan ini')
        }
        throw error
    }
})
