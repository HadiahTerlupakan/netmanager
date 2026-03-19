import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { apiError, ErrorCodes } from '@/lib/api-response'

const GLOBAL_CHAT_NAME = 'Global Chat'

// GET - Get or create global chat and return its ID
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.id as string
        const tenantId = authResult.tenantId as string
        if (!userId) {
            return apiError('Token tidak valid', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        // Find or create global chat
        let globalChat = await prisma.conversation.findFirst({
            where: { isGlobal: true, tenantId }
        })

        if (!globalChat) {
            // Create global chat
            globalChat = await prisma.conversation.create({
                data: {
                    name: GLOBAL_CHAT_NAME,
                    isGlobal: true,
                    tenantId
                }
            })
        }

        // Ensure user is in the User table (Mitra and Customer cannot join)
        const dbUser = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: { id: true }
        })

        if (!dbUser) {
            return apiError('Fitur chat hanya tersedia untuk karyawan.', ErrorCodes.FORBIDDEN, { status: 403 })
        }

        // Ensure user is a participant
        const isParticipant = await prisma.conversationParticipant.findFirst({
            where: {
                conversationId: globalChat.id,
                userId,
                tenantId
            }
        })

        if (!isParticipant) {
            await prisma.conversationParticipant.create({
                data: {
                    conversationId: globalChat.id,
                    userId,
                    tenantId
                }
            })
        }

        // Get participant count
        const participantCount = await prisma.conversationParticipant.count({
            where: { conversationId: globalChat.id, tenantId }
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
