import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET - Get messages for a conversation
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!await hasPermission('chat:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id: conversationId } = await params
        const { searchParams } = new URL(request.url)
        const cursor = searchParams.get('cursor') || undefined
        const limit = parseInt(searchParams.get('limit') || '50')

        const chatService = new ChatService()
        const result = await chatService.getMessages(conversationId, user.id, cursor, limit)

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: unknown) {
        console.error('Error fetching messages:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        
        if (message === 'Not a participant') {
            return NextResponse.json({ error: message }, { status: 403 })
        }
        
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// POST - Send a message
export async function POST(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!await hasPermission('chat:create')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id: conversationId } = await params
        const body = await request.json()
        const { content, imageUrl } = body

        if ((!content || typeof content !== 'string' || content.trim().length === 0) && !imageUrl) {
            return NextResponse.json({ error: 'Message content or image is required' }, { status: 400 })
        }

        const chatService = new ChatService()
        const result = await chatService.sendMessage({
            conversationId,
            senderId: user.id,
            senderName: user.name || 'Admin',
            content,
            imageUrl
        })

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: unknown) {
        console.error('Error sending message:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        
        if (message === 'Not a participant') {
            return NextResponse.json({ error: message }, { status: 403 })
        }
        
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
