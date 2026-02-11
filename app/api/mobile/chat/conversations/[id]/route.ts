import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService'
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
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const { id: conversationId } = await params
        const { searchParams } = new URL(request.url)
        const cursor = searchParams.get('cursor')
        const limit = parseInt(searchParams.get('limit') || '50')

        // Check if user is participant of this conversation
        const participant = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: user.id as string
                }
            }
        })

        if (!participant) {
            return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
        }

        // Get messages with pagination
        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor && {
                cursor: { id: cursor },
                skip: 1
            }),
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        image: true
                    }
                }
            }
        })

        // Determine if there are more messages
        const hasMore = messages.length > limit
        const displayMessages = hasMore ? messages.slice(0, -1) : messages

        // Update last read timestamp
        await prisma.conversationParticipant.update({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: user.id as string
                }
            },
            data: { lastReadAt: new Date() }
        })

        // Get conversation info
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
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

        return NextResponse.json({
            success: true,
            data: {
                conversation: {
                    id: conversation?.id,
                    name: conversation?.isGlobal ? 'Global Chat' : conversation?.name,
                    isGlobal: conversation?.isGlobal,
                    participants: conversation?.participants.map(p => ({
                        id: p.user.id,
                        name: p.user.name,
                        image: p.user.image
                    }))
                },
                messages: displayMessages.map(m => ({
                    id: m.id,
                    content: m.content,
                    imageUrl: m.imageUrl,
                    senderId: m.senderId,
                    senderName: m.sender.name,
                    senderImage: m.sender.image,
                    createdAt: m.createdAt.toISOString(),
                    isOwn: m.senderId === (user.id as string)
                })),
                hasMore,
                nextCursor: hasMore ? displayMessages[displayMessages.length - 1]?.id : null
            }
        })
    } catch (error: unknown) {
        console.error('Error fetching messages:', error)
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// POST - Send a message
export async function POST(
    request: NextRequest,
    { params }: RouteParams
) {
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

        const { id: conversationId } = await params
        const body = await request.json()
        const { content, imageUrl } = body

        if ((!content || typeof content !== 'string' || content.trim().length === 0) && !imageUrl) {
            return NextResponse.json({ error: 'Message content or image is required' }, { status: 400 })
        }

        // Check if user is participant
        const participant = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: user.id as string
                }
            }
        })

        if (!participant) {
            return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
        }

        // Create message
        const newMessage = await prisma.message.create({
            data: {
                conversationId,
                senderId: user.id as string,
                content: content?.trim() || null,
                imageUrl: imageUrl || null
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        image: true
                    }
                }
            }
        })

        // Update conversation timestamp
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        })

        // Update sender's last read timestamp
        await prisma.conversationParticipant.update({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: user.id as string
                }
            },
            data: { lastReadAt: new Date() }
        })

        // Send push notifications to other participants (async, don't wait)
        ;(async () => {
            try {
                // Get all other participants
                const otherParticipants = await prisma.conversationParticipant.findMany({
                    where: {
                        conversationId,
                        userId: { not: user.id as string }
                    },
                    select: { userId: true }
                })

                if (otherParticipants.length > 0) {
                    const otherUserIds = otherParticipants.map(p => p.userId)
                    
                    // Get conversation name for notification
                    const conversation = await prisma.conversation.findUnique({
                        where: { id: conversationId },
                        select: { name: true, isGlobal: true }
                    })
                    
                    const chatName = conversation?.isGlobal 
                        ? 'Global Chat' 
                        : conversation?.name || (user.name as string) || 'Chat'
                    
                    const notificationBody = newMessage.imageUrl 
                        ? '📷 Mengirim gambar' 
                        : (newMessage.content || 'Pesan baru')

                    await sendPushToUsers(
                        otherUserIds,
                        `💬 ${chatName}`,
                        `${user.name as string}: ${notificationBody}`,
                        {
                            type: 'chat_message',
                            conversationId,
                            messageId: newMessage.id
                        }
                    )
                }
            } catch (pushError) {
                console.error('[Chat] Error sending push notifications:', pushError)
            }
        })()

        return NextResponse.json({
            success: true,
            data: {
                id: newMessage.id,
                content: newMessage.content,
                imageUrl: newMessage.imageUrl,
                senderId: newMessage.senderId,
                senderName: newMessage.sender.name,
                senderImage: newMessage.sender.image,
                createdAt: newMessage.createdAt.toISOString(),
                isOwn: true
            }
        })
    } catch (error: unknown) {
        console.error('Error sending message:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
