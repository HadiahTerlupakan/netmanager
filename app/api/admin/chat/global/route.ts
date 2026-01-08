import { verifyAuth } from '@/lib/auth'
import { ChatService } from '@/modules/chat'
import { NextRequest, NextResponse } from 'next/server'

// GET - Get or create global chat and add user as participant
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const chatService = new ChatService()
        const globalChat = await chatService.getGlobalChat(user.id)

        return NextResponse.json({
            success: true,
            data: globalChat
        })
    } catch (error: unknown) {
        console.error('Error getting global chat:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
