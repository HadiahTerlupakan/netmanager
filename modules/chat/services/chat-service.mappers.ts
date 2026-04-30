import { DEFAULT_CHAT_NAME, GLOBAL_CHAT_NAME } from "./chat-service.constants";

import type {
  ChatConversationEntity,
  ChatMessageEntity,
  ChatParticipantEntity,
  ChatUserSummaryEntity,
} from "../domain/entities/ChatEntity";

/** Build unread state for the latest conversation message. */
export function hasUnreadMessage(
  lastMessage: { createdAt: Date } | undefined,
  lastReadAt?: Date | null,
) {
  if (!lastMessage) {
    return false;
  }

  if (!lastReadAt) {
    return true;
  }

  return new Date(lastMessage.createdAt) > new Date(lastReadAt);
}

function mapParticipantSummary(participant: ChatParticipantEntity) {
  return {
    id: participant.user?.id,
    name: participant.user?.name,
    image: participant.user?.image,
  };
}

function buildConversationName(
  conversation: ChatConversationEntity,
  participantNames: string[],
) {
  if (conversation.isGlobal) {
    return GLOBAL_CHAT_NAME;
  }

  return conversation.name || participantNames.join(", ");
}

/** Map conversation entity to route response shape. */
export function mapConversationListItem(
  conversation: ChatConversationEntity,
  userId: string,
) {
  const participants = conversation.participants ?? [];
  const lastMessage = conversation.messages?.[0];
  const otherParticipants = participants
    .filter((participant) => participant.userId !== userId)
    .map(mapParticipantSummary);
  const participantNames = otherParticipants
    .map((participant) => participant.name)
    .filter(Boolean) as string[];
  const currentParticipant = participants.find(
    (participant) => participant.userId === userId,
  );

  return {
    id: conversation.id,
    name: buildConversationName(conversation, participantNames),
    isGlobal: conversation.isGlobal,
    participants: otherParticipants,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content,
          senderName: lastMessage.sender.name,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
    hasUnread: hasUnreadMessage(lastMessage, currentParticipant?.lastReadAt),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

/** Map conversation detail header for message listing. */
export function mapConversationDetail(
  conversation: ChatConversationEntity | null,
) {
  return {
    id: conversation?.id,
    name: conversation?.isGlobal ? GLOBAL_CHAT_NAME : conversation?.name,
    isGlobal: conversation?.isGlobal,
    participants: conversation?.participants?.map(mapParticipantSummary),
  };
}

/** Map message entity to response DTO. */
export function mapChatMessage(message: ChatMessageEntity, userId: string) {
  return {
    id: message.id,
    content: message.content,
    imageUrl: message.imageUrl,
    senderId: message.senderId,
    senderName: message.sender.name,
    senderImage: message.sender.image,
    createdAt: message.createdAt.toISOString(),
    isOwn: message.senderId === userId,
  };
}

/** Map searchable user entity to route response DTO. */
export function mapChatUser(user: ChatUserSummaryEntity) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    department: user.departments?.name,
    site: user.sites?.name,
  };
}

/** Build chat title used by push notifications. */
export function resolveNotificationChatName(
  conversation: ChatConversationEntity | null,
  senderName: string,
) {
  if (conversation?.isGlobal) {
    return GLOBAL_CHAT_NAME;
  }

  return conversation?.name || senderName || DEFAULT_CHAT_NAME;
}
