import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/modules/database'
import { NextRequest, NextResponse } from 'next/server'
import { apiError, ErrorCodes } from '@/lib/api-response'

// GET - Get all conversations for current user
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

        // Get all conversations where user is a participant
        const conversations = await prisma.conversation.findMany({
            where: {
                participants: {
                    some: {
                        userId,
                        tenantId
                    }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        })

        // Format response
        const formattedConversations = conversations.map(conv => {
            const lastMessage = conv.messages[0]
            const otherParticipants = conv.participants
                .filter(p => p.userId !== userId)
                .map(p => ({
                    id: p.user.id,
                    name: p.user.name,
                    image: p.user.image
                }))

            // Get current user's participant record for unread status
            const myParticipant = conv.participants.find(p => p.userId === userId)
            const hasUnread = lastMessage && myParticipant?.lastReadAt
                ? new Date(lastMessage.createdAt) > new Date(myParticipant.lastReadAt)
                : !!lastMessage && !myParticipant?.lastReadAt

            return {
                id: conv.id,
                name: conv.isGlobal ? 'Global Chat' : (conv.name || otherParticipants.map(p => p.name).join(', ')),
                isGlobal: conv.isGlobal,
                participants: otherParticipants,
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    senderName: lastMessage.sender.name,
                    createdAt: lastMessage.createdAt.toISOString()
                } : null,
                hasUnread,
                updatedAt: conv.updatedAt.toISOString()
            }
        })

        return NextResponse.json({
            success: true,
            data: formattedConversations
        })
    } catch (error: unknown) {
        console.error('Error fetching conversations:', error)
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// POST - Create a new conversation
export async function POST(request: NextRequest) {
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

        // Validate that user exists in the User table (Mitra and Customer cannot create conversations)
        const dbUser = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: { id: true }
        })

        if (!dbUser) {
            return apiError('Fitur chat hanya tersedia untuk karyawan.', ErrorCodes.FORBIDDEN, { status: 403 })
        }

        const body = await request.json()
        const { participantIds, name } = body

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return apiError('participantIds is required', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Include current user in participants
        const allParticipantIds = [...new Set([userId, ...participantIds])]

        // For 1-on-1 chats, check if conversation already exists
        if (allParticipantIds.length === 2) {
            const existingConversation = await prisma.conversation.findFirst({
                where: {
                    isGlobal: false,
                    tenantId,
                    participants: {
                        every: {
                            userId: { in: allParticipantIds }
                        }
                    },
                    AND: {
                        participants: {
                            none: {
                                userId: { notIn: allParticipantIds }
                            }
                        }
                    }
                },
                include: {
                    participants: {
                        include: {
                            user: {
                                select: { id: true, name: true, image: true }
                            }
                        }
                    }
                }
            })

            if (existingConversation) {
                return NextResponse.json({
                    success: true,
                    data: {
                        id: existingConversation.id,
                        isExisting: true
                    }
                })
            }
        }

        // Create new conversation
        const conversation = await prisma.conversation.create({
            data: {
                name: name || null,
                isGlobal: false,
                tenantId,
                participants: {
                    create: allParticipantIds.map(id => ({
                        userId: id,
                        tenantId
                    }))
                }
            }
        })

        return NextResponse.json({
            success: true,
            data: {
                id: conversation.id,
                isExisting: false
            }
        })
    } catch (error: unknown) {
        console.error('Error creating conversation:', error)
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
