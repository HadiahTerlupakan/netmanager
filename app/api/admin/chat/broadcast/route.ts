import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'

const broadcastSchema = z.object({
    content: z.string().min(1, 'Konten pesan wajib diisi').max(5000),
    title: z.string().max(200).optional(),
})

// POST - Send broadcast message to all users
export const POST = createHandler({ 
    auth: true, 
    schema: broadcastSchema 
}, async (req, ctx) => {
    const user = ctx.session!.user;

    // Check broadcast permission
    if (!await hasPermission('broadcast:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk broadcast')
    }

    const { content, title } = ctx.validated

    const chatService = new ChatService()
    const result = await chatService.broadcastMessage({
        senderId: user.id,
        senderName: user.name || 'Admin',
        content: content.trim(),
        ...(title ? { title } : {})
    })

    return apiSuccess(result, { status: 201, message: 'Broadcast berhasil dikirim' })
})
