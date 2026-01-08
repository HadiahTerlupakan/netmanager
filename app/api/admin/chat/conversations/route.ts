import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { ChatService } from '@/modules/chat'
import { NextRequest, NextResponse } from 'next/server'

// GET - Get all conversations for current admin user
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const chatService = new ChatService()
        const conversations = await chatService.getConversations(user.id)

        return NextResponse.json({
            success: true,
            data: conversations
        })
    } catch (error: unknown) {
        console.error('Error fetching conversations:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// POST - Create a new conversation
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check permission
        if (!await hasPermission('chat:create')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { participantIds, name } = body

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return NextResponse.json({ error: 'participantIds is required' }, { status: 400 })
        }

        const chatService = new ChatService()
        const result = await chatService.createConversation({
            creatorId: user.id,
            participantIds,
            name
        })

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: unknown) {
        console.error('Error creating conversation:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
