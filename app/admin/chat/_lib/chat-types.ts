/** Pegawai yang bisa diajak chat (hasil GET /api/admin/chat/users). */
export interface ChatUser {
  id: string;
  name: string | null;
  image: string | null;
  email?: string;
  department?: string;
  site?: string;
}

/** Satu pesan seperti yang dikirim server (list, kirim pesan, realtime). */
export interface ChatMessage {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  senderActorType: string;
  senderActorId: string;
  senderName: string | null;
  senderImage?: string | null;
  createdAt: string;
  isOwn: boolean;
}

/** Payload realtime "chat.message": pesan + percakapan tujuannya. */
export interface ChatRealtimeMessage extends ChatMessage {
  conversationId: string;
  isBroadcast?: boolean;
}

/** Ringkasan pesan terakhir yang tampil di daftar percakapan. */
export interface ChatLastMessage {
  content: string | null;
  senderName: string | null;
  createdAt: string;
}

/** Item daftar percakapan di sidebar. */
export interface ChatConversation {
  id: string;
  name: string;
  image?: string | null;
  isGlobal: boolean;
  participants: ChatUser[];
  lastMessage?: ChatLastMessage | null;
  hasUnread: boolean;
  unreadCount?: number;
  updatedAt: string;
}

/** Info kepala percakapan yang sedang dibuka. */
export interface ChatConversationInfo {
  id?: string;
  name?: string;
  image?: string | null;
  isGlobal?: boolean;
  participants?: ChatUser[];
}

/** Ringkasan Global Chat (GET /api/admin/chat/global). */
export interface GlobalChatInfo {
  id: string;
  name: string;
  participantCount: number;
}

/** Isi GET /api/admin/chat/conversations/:id. */
export interface ChatConversationDetail {
  conversation: ChatConversationInfo;
  /** Urutan dari server: terbaru lebih dulu. */
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}
