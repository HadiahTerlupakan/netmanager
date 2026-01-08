import { verifyAuth } from '@/lib/auth'
import { ChatService } from '@/modules/chat'
import { NextRequest, NextResponse } from 'next/server'

// GET - Search users for creating new chat
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined

        const chatService = new ChatService()
        const users = await chatService.searchUsers(search, user.id)

        return NextResponse.json({
            success: true,
            data: users
        })
    } catch (error: unknown) {
        console.error('Error searching users:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
