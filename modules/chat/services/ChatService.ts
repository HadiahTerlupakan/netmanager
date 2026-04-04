import { ChatRepository } from '../repositories/ChatRepository'

export interface SendMessageInput {
    conversationId: string
    senderId: string
    senderName: string
    content?: string | null
    imageUrl?: string | null
}

export interface CreateChatInput {
    creatorId: string
    participantIds: string[]
    name?: string
}

export interface BroadcastMessageInput {
    senderId: string
    senderName: string
    content: string
    title?: string
}

export class ChatService {
    private repository: ChatRepository
    private pushServiceModulePromise?: Promise<typeof import('@/modules/notification/services/ExpoPushService')>
    private socketEmitModulePromise?: Promise<typeof import('@/lib/websocket/emit')>

    constructor() {
        this.repository = new ChatRepository()
    }

    private getPushServiceModule() {
        if (!this.pushServiceModulePromise) {
            this.pushServiceModulePromise = import('@/modules/notification/services/ExpoPushService')
        }

        return this.pushServiceModulePromise
    }

    private getSocketEmitModule() {
        if (!this.socketEmitModulePromise) {
            this.socketEmitModulePromise = import('@/lib/websocket/emit')
        }

        return this.socketEmitModulePromise
    }

    private async sendPushToUsers(
        userIds: string[],
        title: string,
        body: string,
        data?: Record<string, unknown>
    ) {
        const { sendPushToUsers } = await this.getPushServiceModule()
        return sendPushToUsers(userIds, title, body, data)
    }

    private async emitChatMessage(
        userId: string,
        payload: {
            id: string
            content: string | null
            imageUrl?: string | null
            conversationId: string
            senderId: string
            senderName: string
            createdAt: string
            isOwn: boolean
            isBroadcast?: boolean
        }
    ) {
        const { emitSocketEvent } = await this.getSocketEmitModule()
        return emitSocketEvent(`user:${userId}`, 'chat:message', payload)
    }

    /**
     * Get all conversations for a user
     */
    async getConversations(userId: string) {
        const conversations = await this.repository.findConversationsForUser(userId)
        
        return conversations.map(conv => {
            const lastMessage = conv.messages[0]
            const otherParticipants = conv.participants
                .filter(p => p.userId !== userId)
                .map(p => ({
                    id: p.user.id,
                    name: p.user.name,
                    image: p.user.image
                }))

            // Check unread status
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
    }

    /**
     * Get messages for a conversation with pagination
     */
    async getMessages(conversationId: string, userId: string, cursor?: string, limit = 50) {
        // Check if user is participant
        const isParticipant = await this.repository.isParticipant(conversationId, userId)
        if (!isParticipant) {
            throw new Error('Not a participant')
        }

        // Get messages
        const messages = await this.repository.findMessages(conversationId, {
            limit,
            ...(cursor ? { cursor } : {})
        })
        
        // Determine pagination
        const hasMore = messages.length > limit
        const displayMessages = hasMore ? messages.slice(0, -1) : messages

        // Update last read
        await this.repository.updateLastRead(conversationId, userId)

        // Get conversation info
        const conversation = await this.repository.findConversationById(conversationId)

        return {
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
                isOwn: m.senderId === userId
            })),
            hasMore,
            nextCursor: hasMore ? displayMessages[displayMessages.length - 1]?.id : null
        }
    }

    /**
     * Send a message to a conversation
     */
    async sendMessage(input: SendMessageInput) {
        // Check if user is participant
        const isParticipant = await this.repository.isParticipant(input.conversationId, input.senderId)
        if (!isParticipant) {
            throw new Error('Not a participant')
        }

        // Create message
        const message = await this.repository.createMessage({
            conversationId: input.conversationId,
            senderId: input.senderId,
            ...(input.content !== undefined ? { content: input.content } : {}),
            ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {})
        })

        // Update sender's last read
        await this.repository.updateLastRead(input.conversationId, input.senderId)

        // Send push notifications (async)
        this.sendPushNotifications(input.conversationId, input.senderId, input.senderName, message)

        return {
            id: message.id,
            content: message.content,
            imageUrl: message.imageUrl,
            senderId: message.senderId,
            senderName: message.sender.name,
            senderImage: message.sender.image,
            createdAt: message.createdAt.toISOString(),
            isOwn: true
        }
    }

    /**
     * Get or create global chat and add user as participant
     */
    async getGlobalChat(userId: string) {
        const globalChat = await this.repository.findOrCreateGlobalChat()

        // Ensure user is participant
        await this.repository.addParticipant(globalChat.id, userId)

        // Get participant count
        const participantCount = await this.repository.getParticipantCount(globalChat.id)

        return {
            id: globalChat.id,
            name: 'Global Chat',
            isGlobal: true,
            participantCount
        }
    }

    /**
     * Create a new conversation
     */
    async createConversation(input: CreateChatInput) {
        const allParticipantIds = [...new Set([input.creatorId, ...input.participantIds])]

        // For 1-on-1 chats, check if conversation already exists
        if (allParticipantIds.length === 2) {
            const existing = await this.repository.findExisting1on1(allParticipantIds)
            if (existing) {
                return { id: existing.id, isExisting: true }
            }
        }

        // Create new conversation
        const conversation = await this.repository.createConversation({
            participantIds: allParticipantIds,
            ...(input.name ? { name: input.name } : {})
        })

        return { id: conversation.id, isExisting: false }
    }

    /**
     * Search users for creating new chat
     */
    async searchUsers(search?: string, excludeUserId?: string) {
        const users = await this.repository.searchUsers(search, excludeUserId)
        
        return users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            department: user.departments?.name,
            site: user.sites?.name
        }))
    }

    /**
     * Broadcast message to all users
     */
    async broadcastMessage(input: BroadcastMessageInput) {
        // Get or create global chat
        const globalChat = await this.repository.findOrCreateGlobalChat()

        // Add sender as participant if not already
        await this.repository.addParticipant(globalChat.id, input.senderId)

        // Create the broadcast message
        const message = await this.repository.createMessage({
            conversationId: globalChat.id,
            senderId: input.senderId,
            content: `📢 ${input.title || 'Broadcast'}\n\n${input.content}`
        })

        // Get all users and add them to global chat
        const allUsers = await this.repository.getAllActiveUsers()
        for (const user of allUsers) {
            await this.repository.addParticipant(globalChat.id, user.id)
        }

        // Send push notifications to all users except sender
        const otherUserIds = allUsers.filter(u => u.id !== input.senderId).map(u => u.id)
        if (otherUserIds.length > 0) {
            this.sendPushToUsers(
                otherUserIds,
                `📢 ${input.title || 'Broadcast'}`,
                input.content,
                {
                    type: 'broadcast',
                    conversationId: globalChat.id,
                    messageId: message.id
                }
            ).catch(err => console.error('[Chat] Broadcast push error:', err))

            // Emit Socket Event for Broadcast
            otherUserIds.forEach(otherUserId => {
                this.emitChatMessage(otherUserId, {
                    id: message.id,
                    content: message.content,
                    conversationId: globalChat.id,
                    senderId: input.senderId,
                    senderName: input.senderName,
                    createdAt: message.createdAt.toISOString(),
                    isOwn: false,
                    isBroadcast: true
                }).catch(err => console.error('[Chat] Broadcast socket emit error:', err))
            })
        }

        return {
            id: message.id,
            content: message.content,
            sentToCount: allUsers.length,
            createdAt: message.createdAt.toISOString()
        }
    }

    /**
     * Send push notifications to other participants
     */
    private async sendPushNotifications(
        conversationId: string,
        senderId: string,
        senderName: string,
        message: { id: string; content: string | null; imageUrl: string | null }
    ) {
        try {
            const otherParticipants = await this.repository.getOtherParticipants(conversationId, senderId)
            
            if (otherParticipants.length > 0) {
                const otherUserIds = otherParticipants.map(p => p.userId)
                
                const conversation = await this.repository.findConversationById(conversationId)
                const chatName = conversation?.isGlobal 
                    ? 'Global Chat' 
                    : conversation?.name || senderName || 'Chat'
                
                const notificationBody = message.imageUrl 
                    ? '📷 Mengirim gambar' 
                    : (message.content || 'Pesan baru')

                await this.sendPushToUsers(
                    otherUserIds,
                    `💬 ${chatName}`,
                    `${senderName}: ${notificationBody}`,
                    {
                        type: 'chat_message',
                        conversationId,
                        messageId: message.id
                    }
                )

                // Emit Socket Event to other participants
                otherUserIds.forEach(otherUserId => {
                    this.emitChatMessage(otherUserId, {
                        id: message.id,
                        content: message.content,
                        imageUrl: message.imageUrl,
                        conversationId,
                        senderId,
                        senderName,
                        createdAt: new Date().toISOString(),
                        isOwn: false
                    }).catch(err => console.error('[Chat] Socket emit error:', err))
                })
            }
        } catch (error) {
            console.error('[Chat] Error sending push notifications:', error)
        }
    }
}
