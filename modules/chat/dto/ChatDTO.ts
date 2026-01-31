/**
 * Chat DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * DTO for chat room list views
 */
export interface ChatRoomListItemDTO {
    id: string
    name: string | null
    type: string
    lastMessage: string | null
    lastMessageAt: string | null
    unreadCount: number
    participants: {
        id: string
        name: string | null
    }[]
}

/**
 * DTO for chat room detail
 */
export interface ChatRoomDetailDTO {
    id: string
    name: string | null
    type: string
    createdAt: string
    participants: ChatParticipantDTO[]
    messages: ChatMessageDTO[]
}

/**
 * DTO for chat participant
 */
export interface ChatParticipantDTO {
    id: string
    userId: string
    userName: string | null
    userEmail: string
    joinedAt: string
    lastReadAt: string | null
}

/**
 * DTO for chat message
 */
export interface ChatMessageDTO {
    id: string
    content: string
    type: string
    senderId: string
    senderName: string | null
    createdAt: string
    isRead: boolean
    attachments: ChatAttachmentDTO[]
}

/**
 * DTO for chat attachment
 */
export interface ChatAttachmentDTO {
    id: string
    url: string
    type: string
    name: string
    size: number
}

// ==================== Request DTOs ====================

/**
 * DTO for creating chat room
 */
export interface CreateChatRoomDTO {
    name?: string
    type: 'DIRECT' | 'GROUP'
    participantIds: string[]
}

/**
 * DTO for sending message
 */
export interface SendMessageDTO {
    roomId: string
    content: string
    type?: 'TEXT' | 'IMAGE' | 'FILE'
    attachments?: {
        url: string
        type: string
        name: string
        size: number
    }[]
}
