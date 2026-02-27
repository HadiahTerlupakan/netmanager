import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// GET - Get all conversations for current user
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        // Get all conversations where user is a participant
        const conversations = await prisma.conversation.findMany({
            where: {
                participants: {
                    some: {
                        userId: user.id
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
                .filter(p => p.userId !== user.id)
                .map(p => ({
                    id: p.user.id,
                    name: p.user.name,
                    image: p.user.image
                }))

            // Get current user's participant record for unread status
            const myParticipant = conv.participants.find(p => p.userId === user.id)
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
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        // Validate that user exists in the User table (Mitra and Customer cannot create conversations)
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id as string },
            select: { id: true }
        })

        if (!dbUser) {
            return NextResponse.json({ error: 'Fitur chat hanya tersedia untuk karyawan.' }, { status: 403 })
        }

        const body = await request.json()
        const { participantIds, name } = body

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return NextResponse.json({ error: 'participantIds is required' }, { status: 400 })
        }

        // Include current user in participants
        const allParticipantIds = [...new Set([user.id, ...participantIds])]

        // For 1-on-1 chats, check if conversation already exists
        if (allParticipantIds.length === 2) {
            const existingConversation = await prisma.conversation.findFirst({
                where: {
                    isGlobal: false,
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
                participants: {
                    create: allParticipantIds.map(id => ({
                        userId: id
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
