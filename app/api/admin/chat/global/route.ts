import { ChatService } from '@/modules/chat'
import { apiSuccess, createHandler } from '@/lib/api'

// GET - Get or create global chat and add user as participant
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const chatService = new ChatService()
    const globalChat = await chatService.getGlobalChat(ctx.session!.user.id)

    return apiSuccess(globalChat)
})
