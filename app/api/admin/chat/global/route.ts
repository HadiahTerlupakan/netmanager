import { verifyAuth } from '@/lib/auth'
import { ChatService } from '@/modules/chat'
import { NextRequest } from 'next/server'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

// GET - Get or create global chat and add user as participant
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const chatService = new ChatService()
        const globalChat = await chatService.getGlobalChat(user.id)

        return apiSuccess(globalChat)
    } catch (error: unknown) {
        console.error('Error getting global chat:', error)
        return ApiErrors.internalError('Gagal mengambil global chat')
    }
}
