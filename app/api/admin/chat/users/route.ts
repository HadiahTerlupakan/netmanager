import { ChatService } from '@/modules/chat'
import { apiSuccess, createHandler } from '@/lib/api'

// GET - Search users for creating new chat
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') || undefined

    const chatService = new ChatService()
    const users = await chatService.searchUsers(search, ctx.session!.user.id)

    return apiSuccess(users)
})
