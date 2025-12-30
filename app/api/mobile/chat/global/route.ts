import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const GLOBAL_CHAT_NAME = 'Global Chat'

// GET - Get or create global chat and return its ID
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }
        
        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        // Find or create global chat
        let globalChat = await prisma.conversation.findFirst({
            where: { isGlobal: true }
        })

        if (!globalChat) {
            // Create global chat
            globalChat = await prisma.conversation.create({
                data: {
                    name: GLOBAL_CHAT_NAME,
                    isGlobal: true
                }
            })
        }

        // Ensure user is a participant
        const isParticipant = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: globalChat.id,
                    userId: user.id
                }
            }
        })

        if (!isParticipant) {
            await prisma.conversationParticipant.create({
                data: {
                    conversationId: globalChat.id,
                    userId: user.id
                }
            })
        }

        // Get participant count
        const participantCount = await prisma.conversationParticipant.count({
            where: { conversationId: globalChat.id }
        })

        return NextResponse.json({
            success: true,
            data: {
                id: globalChat.id,
                name: GLOBAL_CHAT_NAME,
                isGlobal: true,
                participantCount
            }
        })
    } catch (error: unknown) {
        console.error('Error getting global chat:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
