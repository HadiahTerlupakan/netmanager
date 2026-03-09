import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const GLOBAL_CHAT_NAME = 'Global Chat'

// GET - Get or create global chat and return its ID
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.userId as string
        if (!userId) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
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

        // Ensure user is in the User table (Mitra and Customer cannot join)
        const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'Fitur chat hanya tersedia untuk karyawan.' }, { status: 403 })
        }

        // Ensure user is a participant
        const isParticipant = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: globalChat.id,
                userId
                }
            }
        })

        if (!isParticipant) {
            await prisma.conversationParticipant.create({
                data: {
                    conversationId: globalChat.id,
                    userId
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
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
