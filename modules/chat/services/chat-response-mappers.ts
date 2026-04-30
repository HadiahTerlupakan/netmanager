const GLOBAL_CHAT_NAME = "Global Chat";
const DEFAULT_CHAT_NAME = "Chat";

interface ConversationParticipantView {
  userId: string;
  lastReadAt?: Date | null;
  user: { id: string; name: string | null; image: string | null };
}

interface ConversationListItemView {
  id: string;
  name: string | null;
  isGlobal: boolean;
  updatedAt: Date;
  participants: ConversationParticipantView[];
  messages: Array<{
    content: string | null;
    createdAt: Date;
    sender: { name: string | null };
  }>;
}

interface ConversationDetailView {
  id: string;
  name: string | null;
  isGlobal: boolean;
  participants: Array<{
    user: { id: string; name: string | null; image: string | null };
  }>;
}

interface MessageView {
  id: string;
  content: string | null;
  imageUrl: string | null;
  senderId: string;
  createdAt: Date;
  sender: { name: string | null; image: string | null };
}

export function hasUnreadMessage(
  lastMessage: { createdAt: Date } | undefined,
  lastReadAt?: Date | null,
) {
  if (!lastMessage) return false;
  if (!lastReadAt) return true;
  return new Date(lastMessage.createdAt) > new Date(lastReadAt);
}

export function mapConversationListItem(
  conversation: ConversationListItemView,
  userId: string,
) {
  const lastMessage = conversation.messages[0];
  const otherParticipants = mapOtherParticipants(conversation, userId);
  const myParticipant = conversation.participants.find(
    (participant) => participant.userId === userId,
  );
  return {
    id: conversation.id,
    name: getConversationName(conversation, otherParticipants),
    isGlobal: conversation.isGlobal,
    participants: otherParticipants,
    lastMessage: lastMessage ? mapLastMessage(lastMessage) : null,
    hasUnread: hasUnreadMessage(lastMessage, myParticipant?.lastReadAt),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function mapConversationDetail(
  conversation?: ConversationDetailView | null,
) {
  return {
    id: conversation?.id,
    name: conversation?.isGlobal ? GLOBAL_CHAT_NAME : conversation?.name,
    isGlobal: conversation?.isGlobal,
    participants: conversation?.participants.map((participant) => ({
      id: participant.user.id,
      name: participant.user.name,
      image: participant.user.image,
    })),
  };
}

export function mapChatMessage(message: MessageView, userId: string) {
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

function mapOtherParticipants(
  conversation: ConversationListItemView,
  userId: string,
) {
  return conversation.participants
    .filter((participant) => participant.userId !== userId)
    .map((participant) => ({
      id: participant.user.id,
      name: participant.user.name,
      image: participant.user.image,
    }));
}

function getConversationName(
  conversation: ConversationListItemView,
  participants: Array<{ name: string | null }>,
) {
  if (conversation.isGlobal) return GLOBAL_CHAT_NAME;
  return (
    conversation.name ||
    participants.map((item) => item.name).join(", ") ||
    DEFAULT_CHAT_NAME
  );
}

function mapLastMessage(message: ConversationListItemView["messages"][number]) {
  return {
    content: message.content,
    senderName: message.sender.name,
    createdAt: message.createdAt.toISOString(),
  };
}
