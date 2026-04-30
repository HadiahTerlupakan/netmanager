import {
  DEFAULT_BROADCAST_TITLE,
  DEFAULT_CHAT_NAME,
  GLOBAL_CHAT_NAME,
  IMAGE_NOTIFICATION_TEXT,
  NEW_MESSAGE_FALLBACK,
} from "./chat.constants";

type ChatUserSummary = {
  id: string;
  name: string | null;
  image?: string | null;
};

type ChatParticipant = {
  userId: string;
  lastReadAt?: Date | null;
  user?: ChatUserSummary;
};

type ChatMessage = {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  senderId: string;
  sender: ChatUserSummary;
  createdAt: Date;
};

type ChatConversation = {
  id: string;
  name?: string | null;
  isGlobal: boolean;
  participants?: ChatParticipant[];
  messages?: ChatMessage[];
  updatedAt: Date;
};

type UserSearchRecord = ChatUserSummary & {
  email?: string | null;
  departments?: { name: string | null } | null;
  sites?: { name: string | null } | null;
};

/** Format ringkasan conversation untuk daftar chat. */
export function formatConversationListItem(
  conversation: ChatConversation,
  userId: string,
) {
  const lastMessage = conversation.messages?.[0];
  const otherParticipants = (conversation.participants ?? [])
    .filter((participant) => participant.userId !== userId)
    .map((participant) => ({
      id: participant.user?.id ?? participant.userId,
      name: participant.user?.name ?? null,
      image: participant.user?.image ?? null,
    }));
  const myParticipant = conversation.participants?.find(
    (participant) => participant.userId === userId,
  );

  return {
    id: conversation.id,
    name: resolveConversationName(conversation, otherParticipants),
    isGlobal: conversation.isGlobal,
    participants: otherParticipants,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content,
          senderName: lastMessage.sender.name,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
    hasUnread: hasUnreadMessage(lastMessage, myParticipant?.lastReadAt),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

/** Format response detail pesan conversation. */
export function formatConversationMessagesResponse(
  conversation: Omit<ChatConversation, "messages" | "updatedAt">,
  messages: ChatMessage[],
  userId: string,
  limit: number,
) {
  const hasMore = messages.length > limit;
  const displayMessages = hasMore ? messages.slice(0, -1) : messages;

  return {
    conversation: formatConversationSummary(conversation),
    messages: displayMessages.map((message) =>
      formatConversationMessageItem(message, userId),
    ),
    hasMore,
    nextCursor: hasMore
      ? displayMessages[displayMessages.length - 1]?.id
      : null,
  };
}

/** Format response pesan baru yang baru terkirim. */
export function formatSentMessageResponse(
  message: ChatMessage,
  senderId: string,
) {
  return {
    id: message.id,
    content: message.content,
    imageUrl: message.imageUrl,
    senderId: message.senderId,
    senderName: message.sender.name,
    senderImage: message.sender.image,
    createdAt: message.createdAt.toISOString(),
    isOwn: message.senderId === senderId,
  };
}

/** Format response global chat. */
export function formatGlobalChatResponse(
  globalChat: { id: string },
  participantCount: number,
) {
  return {
    id: globalChat.id,
    name: GLOBAL_CHAT_NAME,
    isGlobal: true,
    participantCount,
  };
}

/** Format response pencarian user chat. */
export function formatUserSearchResult(user: UserSearchRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    department: user.departments?.name,
    site: user.sites?.name,
  };
}

/** Format payload body notifikasi pesan chat. */
export function buildChatNotificationBody(message: {
  imageUrl: string | null;
  content: string | null;
}) {
  return message.imageUrl
    ? IMAGE_NOTIFICATION_TEXT
    : message.content || NEW_MESSAGE_FALLBACK;
}

/** Format judul chat untuk push notification. */
export function buildChatNotificationTitle(
  conversation: { isGlobal?: boolean; name?: string | null } | null,
  senderName: string,
): string {
  const chatName = conversation?.isGlobal
    ? GLOBAL_CHAT_NAME
    : conversation?.name || senderName || DEFAULT_CHAT_NAME;
  return `Chat ${chatName}`;
}

/** Format konten broadcast yang akan dikirim ke chat global. */
export function buildBroadcastContent(input: {
  title?: string;
  content: string;
}): string {
  return `[Broadcast] ${input.title || DEFAULT_BROADCAST_TITLE}\n\n${input.content}`;
}

/** Format judul push notification broadcast. */
export function buildBroadcastTitle(title?: string): string {
  return `Broadcast ${title || DEFAULT_BROADCAST_TITLE}`;
}

function resolveConversationName(
  conversation: Pick<ChatConversation, "isGlobal" | "name">,
  otherParticipants: ChatUserSummary[],
): string {
  if (conversation.isGlobal) {
    return GLOBAL_CHAT_NAME;
  }

  return (
    conversation.name || otherParticipants.map((item) => item.name).join(", ")
  );
}

function formatConversationSummary(
  conversation: Omit<ChatConversation, "messages" | "updatedAt">,
) {
  return {
    id: conversation.id,
    name: conversation.isGlobal ? GLOBAL_CHAT_NAME : conversation.name,
    isGlobal: conversation.isGlobal,
    participants: (conversation.participants ?? []).map((participant) => ({
      id: participant.user?.id ?? participant.userId,
      name: participant.user?.name ?? null,
      image: participant.user?.image ?? null,
    })),
  };
}

function formatConversationMessageItem(message: ChatMessage, userId: string) {
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

function hasUnreadMessage(
  lastMessage: { createdAt: Date } | undefined,
  lastReadAt?: Date | null,
): boolean {
  if (!lastMessage) {
    return false;
  }

  if (!lastReadAt) {
    return true;
  }

  return new Date(lastMessage.createdAt) > new Date(lastReadAt);
}
