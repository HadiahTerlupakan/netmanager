import { verifyAuth } from '@/lib/auth'
import { ChatService } from '@/modules/chat'
import { NextRequest } from 'next/server'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

// GET - Search users for creating new chat
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined

        const chatService = new ChatService()
        const users = await chatService.searchUsers(search, user.id)

        return apiSuccess(users)
    } catch (error: unknown) {
        console.error('Error searching users:', error)
        return ApiErrors.internalError('Gagal mencari pengguna')
    }
}
