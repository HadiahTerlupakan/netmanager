import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'

const createConversationSchema = z.object({
    participantIds: z.array(z.string().uuid()).min(1, 'Minimal 1 peserta'),
    name: z.string().max(100).optional(),
})

// GET - Get all conversations for current admin user
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const chatService = new ChatService()
    const conversations = await chatService.getConversations(ctx.session!.user.id)

    return apiSuccess(conversations)
})

// POST - Create a new conversation
export const POST = createHandler({ 
    auth: true, 
    schema: createConversationSchema 
}, async (req, ctx) => {
    // Check permission
    if (!await hasPermission('chat:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat percakapan')
    }

    const { participantIds, name } = ctx.validated

    const chatService = new ChatService()
    const result = await chatService.createConversation({
        creatorId: ctx.session!.user.id,
        participantIds,
        ...(name ? { name } : {})
    })

    return apiSuccess(result, { status: 201, message: 'Percakapan berhasil dibuat' })
})
