/**
 * ChatFactory
 *
 * Factory pattern for creating Chat entities (Room, Message).
 */

export interface CreateChatRoomInput {
    name?: string
    type: 'DIRECT' | 'GROUP'
    participantIds: string[]
}

export interface CreateChatMessageInput {
    roomId: string
    senderId: string
    content: string
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
}

export class ChatFactory {
    /**
     * Create direct message room (1-on-1)
     */
    static createDirectRoom(dto: {
        userId1: string
        userId2: string
    }): CreateChatRoomInput {
        return {
            type: 'DIRECT',
            participantIds: [dto.userId1, dto.userId2],
        }
    }

    /**
     * Create group chat room
     */
    static createGroupRoom(dto: {
        name: string
        creatorId: string
        memberIds: string[]
    }): CreateChatRoomInput {
        // Include creator in participants
        const participantIds = [dto.creatorId, ...dto.memberIds.filter(id => id !== dto.creatorId)]

        return {
            name: dto.name,
            type: 'GROUP',
            participantIds,
        }
    }

    /**
     * Create department chat room
     */
    static createDepartmentRoom(dto: {
        departmentName: string
        memberIds: string[]
    }): CreateChatRoomInput {
        return {
            name: `Grup ${dto.departmentName}`,
            type: 'GROUP',
            participantIds: dto.memberIds,
        }
    }

    /**
     * Create site/branch chat room
     */
    static createSiteRoom(dto: {
        siteName: string
        memberIds: string[]
    }): CreateChatRoomInput {
        return {
            name: `Tim ${dto.siteName}`,
            type: 'GROUP',
            participantIds: dto.memberIds,
        }
    }

    /**
     * Create text message
     */
    static createTextMessage(dto: {
        roomId: string
        senderId: string
        content: string
    }): CreateChatMessageInput {
        return {
            roomId: dto.roomId,
            senderId: dto.senderId,
            content: dto.content,
            type: 'TEXT',
        }
    }

    /**
     * Create image message
     */
    static createImageMessage(dto: {
        roomId: string
        senderId: string
        imageUrl: string
        caption?: string
    }): CreateChatMessageInput {
        return {
            roomId: dto.roomId,
            senderId: dto.senderId,
            content: dto.caption || dto.imageUrl,
            type: 'IMAGE',
        }
    }

    /**
     * Create file message
     */
    static createFileMessage(dto: {
        roomId: string
        senderId: string
        fileUrl: string
        fileName: string
    }): CreateChatMessageInput {
        return {
            roomId: dto.roomId,
            senderId: dto.senderId,
            content: `📎 ${dto.fileName}`,
            type: 'FILE',
        }
    }

    /**
     * Create system message (join/leave/etc)
     */
    static createSystemMessage(dto: {
        roomId: string
        content: string
    }): CreateChatMessageInput {
        return {
            roomId: dto.roomId,
            senderId: 'SYSTEM',
            content: dto.content,
            type: 'SYSTEM',
        }
    }

    /**
     * Generate room name for direct chat
     */
    static generateDirectRoomName(user1Name: string, user2Name: string): string {
        return `${user1Name} & ${user2Name}`
    }
}
