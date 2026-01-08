import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { NextRequest, NextResponse } from 'next/server'

// POST - Send broadcast message to all users
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check broadcast permission
        if (!await hasPermission('broadcast:create')) {
            return NextResponse.json({ error: 'Forbidden: No broadcast permission' }, { status: 403 })
        }
        // For now, any authenticated admin can broadcast
        // You can add: if (!user.permissions?.includes('chat:broadcast')) { return 403 }

        const body = await request.json()
        const { content, title } = body

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        const chatService = new ChatService()
        const result = await chatService.broadcastMessage({
            senderId: user.id,
            senderName: user.name || 'Admin',
            content: content.trim(),
            title
        })

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: unknown) {
        console.error('Error broadcasting message:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
