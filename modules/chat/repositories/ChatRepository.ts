import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface CreateMessageInput {
    conversationId: string
    senderId: string
    content?: string | null
    imageUrl?: string | null
}

export interface CreateConversationInput {
    participantIds: string[]
    name?: string
    isGlobal?: boolean
}

export class ChatRepository {
    /**
     * Find all conversations for a user
     */
    async findConversationsForUser(userId: string) {
        return prisma.conversation.findMany({
            where: {
                participants: {
                    some: { userId }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                email: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: {
                            select: { id: true, name: true }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        })
    }

    /**
     * Find conversation by ID with participants
     */
    async findConversationById(conversationId: string) {
        return prisma.conversation.findUnique({
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
    }

    /**
     * Get messages for a conversation with pagination
     */
    async findMessages(
        conversationId: string, 
        options: { cursor?: string; limit?: number } = {}
    ) {
        const { cursor, limit = 50 } = options
        
        return prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            include: {
                sender: {
                    select: { id: true, name: true, image: true }
                }
            }
        })
    }

    /**
     * Create a new message
     */
    async createMessage(input: CreateMessageInput) {
        const message = await prisma.message.create({
            data: {
                conversationId: input.conversationId,
                senderId: input.senderId,
                content: input.content?.trim() || null,
                imageUrl: input.imageUrl || null
            },
            include: {
                sender: {
                    select: { id: true, name: true, image: true }
                }
            }
        })

        // Update conversation timestamp
        await prisma.conversation.update({
            where: { id: input.conversationId },
            data: { updatedAt: new Date() }
        })

        return message
    }

    /**
     * Find or create global chat
     */
    async findOrCreateGlobalChat() {
        let globalChat = await prisma.conversation.findFirst({
            where: { isGlobal: true }
        })

        if (!globalChat) {
            globalChat = await prisma.conversation.create({
                data: {
                    name: 'Global Chat',
                    isGlobal: true
                }
            })
        }

        return globalChat
    }

    /**
     * Check if user is participant of a conversation
     */
    async isParticipant(conversationId: string, userId: string) {
        const participant = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: { conversationId, userId }
            }
        })
        return !!participant
    }

    /**
     * Get participant record
     */
    async getParticipant(conversationId: string, userId: string) {
        return prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: { conversationId, userId }
            }
        })
    }

    /**
     * Add user as participant to conversation
     */
    async addParticipant(conversationId: string, userId: string) {
        return prisma.conversationParticipant.upsert({
            where: {
                conversationId_userId: { conversationId, userId }
            },
            create: { conversationId, userId },
            update: {}
        })
    }

    /**
     * Update last read timestamp for a participant
     */
    async updateLastRead(conversationId: string, userId: string) {
        return prisma.conversationParticipant.update({
            where: {
                conversationId_userId: { conversationId, userId }
            },
            data: { lastReadAt: new Date() }
        })
    }

    /**
     * Create a new conversation
     */
    async createConversation(input: CreateConversationInput) {
        return prisma.conversation.create({
            data: {
                name: input.name || null,
                isGlobal: input.isGlobal || false,
                participants: {
                    create: input.participantIds.map(userId => ({ userId }))
                }
            }
        })
    }

    /**
     * Find existing 1-on-1 conversation between two users
     */
    async findExisting1on1(userIds: string[]) {
        if (userIds.length !== 2) return null

        return prisma.conversation.findFirst({
            where: {
                isGlobal: false,
                participants: {
                    every: { userId: { in: userIds } }
                },
                AND: {
                    participants: {
                        none: { userId: { notIn: userIds } }
                    }
                }
            }
        })
    }

    /**
     * Get all participants of a conversation (except specific user)
     */
    async getOtherParticipants(conversationId: string, excludeUserId: string) {
        return prisma.conversationParticipant.findMany({
            where: {
                conversationId,
                userId: { not: excludeUserId }
            },
            select: { userId: true }
        })
    }

    /**
     * Get participant count for a conversation
     */
    async getParticipantCount(conversationId: string) {
        return prisma.conversationParticipant.count({
            where: { conversationId }
        })
    }

    /**
     * Search users for creating new chat
     */
    async searchUsers(search?: string, excludeUserId?: string) {
        const where: Prisma.UserWhereInput = {
            ...(excludeUserId && { id: { not: excludeUserId } }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            })
        }

        return prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                departments: { select: { name: true } },
                sites: { select: { name: true } }
            },
            take: 20,
            orderBy: { name: 'asc' }
        })
    }

    /**
     * Get all active users for broadcast
     */
    async getAllActiveUsers() {
        return prisma.user.findMany({
            select: { id: true },
            orderBy: { name: 'asc' }
        })
    }
}
