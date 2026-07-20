import {
  DEFAULT_BROADCAST_TITLE,
  DEFAULT_CHAT_NAME,
  GLOBAL_CHAT_NAME,
  IMAGE_NOTIFICATION_TEXT,
  NEW_MESSAGE_FALLBACK,
} from "./chat.constants";
import type { ChatActor } from "../domain/entities/ChatEntity";
import { participantSummary, resolveActorSummary } from "./actor-resolver";

type ChatUserSummary = {
  id: string;
  name: string | null;
  image?: string | null;
};

type ChatParticipant = {
  userId: string | null;
  actorType: string;
  actorId: string | null;
  lastReadAt?: Date | null;
  user?: ChatUserSummary | null;
};

type ChatMessage = {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  senderId: string | null;
  actorType: string;
  actorId: string | null;
  sender: ChatUserSummary | null;
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

function isActorMatch(
  participant: { actorType: string; actorId: string | null },
  actor: ChatActor,
): boolean {
  return (
    participant.actorType === actor.type && participant.actorId === actor.id
  );
}

/** Format ringkasan conversation untuk daftar chat. */
export async function formatConversationListItem(
  conversation: ChatConversation,
  actor: ChatActor,
) {
  const lastMessage = conversation.messages?.[0];
  const otherParticipants = await resolveParticipants(
    (conversation.participants ?? []).filter(
      (participant) => !isActorMatch(participant, actor),
    ),
  );
  const myParticipant = conversation.participants?.find((participant) =>
    isActorMatch(participant, actor),
  );

  return {
    id: conversation.id,
    name: resolveConversationName(conversation, otherParticipants),
    isGlobal: conversation.isGlobal,
    participants: otherParticipants,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content,
          senderName: await resolveSenderName(lastMessage),
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
    hasUnread: hasUnreadMessage(lastMessage, myParticipant?.lastReadAt),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

/** Format response detail pesan conversation. */
export async function formatConversationMessagesResponse(
  conversation: Omit<ChatConversation, "messages" | "updatedAt">,
  messages: ChatMessage[],
  actor: ChatActor,
  limit: number,
) {
  const hasMore = messages.length > limit;
  const displayMessages = hasMore ? messages.slice(0, -1) : messages;

  return {
    conversation: await formatConversationSummary(conversation),
    messages: await Promise.all(
      displayMessages.map((message) =>
        formatConversationMessageItem(message, actor),
      ),
    ),
    hasMore,
    nextCursor: hasMore
      ? displayMessages[displayMessages.length - 1]?.id
      : null,
  };
}

/** Format response pesan baru yang baru terkirim. */
export async function formatSentMessageResponse(
  message: ChatMessage,
  sender: ChatActor,
) {
  const senderName = await resolveSenderName(message);
  return {
    id: message.id,
    content: message.content,
    imageUrl: message.imageUrl,
    senderActorType: message.actorType,
    senderActorId: message.actorId,
    senderName,
    senderImage: message.sender?.image ?? null,
    createdAt: message.createdAt.toISOString(),
    isOwn: isActorMatch(message, sender),
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

async function formatConversationSummary(
  conversation: Omit<ChatConversation, "messages" | "updatedAt">,
) {
  return {
    id: conversation.id,
    name: conversation.isGlobal ? GLOBAL_CHAT_NAME : conversation.name,
    isGlobal: conversation.isGlobal,
    participants: await resolveParticipants(conversation.participants ?? []),
  };
}

async function formatConversationMessageItem(
  message: ChatMessage,
  actor: ChatActor,
) {
  return {
    id: message.id,
    content: message.content,
    imageUrl: message.imageUrl,
    senderActorType: message.actorType,
    senderActorId: message.actorId,
    senderName: await resolveSenderName(message),
    senderImage: message.sender?.image ?? null,
    createdAt: message.createdAt.toISOString(),
    isOwn: isActorMatch(message, actor),
  };
}

async function resolveParticipants(
  participants: ChatParticipant[],
): Promise<ChatUserSummary[]> {
  return Promise.all(
    participants.map(async (participant) => {
      const summary = participantSummary(participant);
      if (summary && summary.name) return summary;
      if (participant.actorId && participant.actorType !== "user") {
        const resolved = await resolveActorSummary({
          type: participant.actorType as ChatActor["type"],
          id: participant.actorId,
        });
        if (resolved) return resolved;
      }
      return (
        summary ?? {
          id: participant.actorId ?? participant.userId ?? "",
          name: null,
        }
      );
    }),
  );
}

async function resolveSenderName(message: ChatMessage): Promise<string> {
  if (message.sender?.name) return message.sender.name;
  if (message.actorId && message.actorType !== "user") {
    const resolved = await resolveActorSummary({
      type: message.actorType as ChatActor["type"],
      id: message.actorId,
    });
    if (resolved?.name) return resolved.name;
  }
  return message.sender?.name ?? "Unknown";
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
