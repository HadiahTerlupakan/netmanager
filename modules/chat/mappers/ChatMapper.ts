/**
 * ChatMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type {
    ChatRoomListItemDTO,
    ChatRoomDetailDTO,
    ChatParticipantDTO,
    ChatMessageDTO,
    ChatAttachmentDTO,
} from '../dto/ChatDTO'

// Types based on chat models
interface ChatRoom {
    id: string
    name: string | null
    type: string
    createdAt: Date
}

interface ChatParticipant {
    id: string
    roomId: string
    userId: string
    joinedAt: Date
    lastReadAt: Date | null
    user?: {
        id: string
        name: string | null
        email: string
    }
}

interface ChatMessage {
    id: string
    roomId: string
    senderId: string
    content: string
    type: string
    createdAt: Date
    isRead: boolean
    sender?: {
        id: string
        name: string | null
    }
    attachments?: ChatAttachment[]
}

interface ChatAttachment {
    id: string
    url: string
    type: string
    name: string
    size: number
}

type ChatRoomWithRelations = ChatRoom & {
    participants?: ChatParticipant[]
    messages?: ChatMessage[]
    _count?: {
        messages?: number
    }
}

export class ChatMapper {
    /**
     * Map to room list item DTO
     */
    static toRoomListItem(
        entity: ChatRoomWithRelations,
        currentUserId: string
    ): ChatRoomListItemDTO {
        const lastMessage = entity.messages?.[0]
        const currentParticipant = entity.participants?.find(p => p.userId === currentUserId)

        // Count unread messages
        const unreadCount = entity.messages?.filter(m =>
            !m.isRead &&
            m.senderId !== currentUserId &&
            (!currentParticipant?.lastReadAt || m.createdAt > currentParticipant.lastReadAt)
        ).length ?? 0

        return {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            lastMessage: lastMessage?.content ?? null,
            lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
            unreadCount,
            participants: (entity.participants ?? [])
                .filter(p => p.userId !== currentUserId)
                .slice(0, 3)
                .map(p => ({
                    id: p.userId,
                    name: p.user?.name ?? null,
                })),
        }
    }

    /**
     * Map to room detail DTO
     */
    static toRoomDetail(entity: ChatRoomWithRelations): ChatRoomDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            createdAt: entity.createdAt.toISOString(),
            participants: (entity.participants ?? []).map(p => this.toParticipant(p)),
            messages: (entity.messages ?? []).map(m => this.toMessage(m)),
        }
    }

    /**
     * Map participant to DTO
     */
    static toParticipant(entity: ChatParticipant): ChatParticipantDTO {
        return {
            id: entity.id,
            userId: entity.userId,
            userName: entity.user?.name ?? null,
            userEmail: entity.user?.email ?? '',
            joinedAt: entity.joinedAt.toISOString(),
            lastReadAt: entity.lastReadAt?.toISOString() ?? null,
        }
    }

    /**
     * Map message to DTO
     */
    static toMessage(entity: ChatMessage): ChatMessageDTO {
        return {
            id: entity.id,
            content: entity.content,
            type: entity.type,
            senderId: entity.senderId,
            senderName: entity.sender?.name ?? null,
            createdAt: entity.createdAt.toISOString(),
            isRead: entity.isRead,
            attachments: (entity.attachments ?? []).map(a => this.toAttachment(a)),
        }
    }

    /**
     * Map messages to DTOs
     */
    static toMessages(entities: ChatMessage[]): ChatMessageDTO[] {
        return entities.map(entity => this.toMessage(entity))
    }

    /**
     * Map attachment to DTO
     */
    static toAttachment(entity: ChatAttachment): ChatAttachmentDTO {
        return {
            id: entity.id,
            url: entity.url,
            type: entity.type,
            name: entity.name,
            size: entity.size,
        }
    }
}
