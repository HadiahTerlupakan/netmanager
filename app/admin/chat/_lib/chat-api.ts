import type {
  ChatConversationDetail,
  ChatMessage,
  ChatUser,
} from "./chat-types";

/** Pesan saat permintaan tidak sampai ke server (fetch melempar galat). */
export const CHAT_NETWORK_ERROR_MESSAGE =
  "Tidak tersambung ke internet. Coba lagi sebentar lagi.";

/** Pesan cadangan per aksi bila server tidak memberi alasan yang jelas. */
export const CHAT_FALLBACK_MESSAGES = {
  loadConversations:
    "Daftar chat belum bisa dimuat. Muat ulang halaman ini sebentar lagi.",
  loadMessages:
    "Isi chat belum bisa dibuka. Klik lagi percakapannya untuk mencoba.",
  sendMessage: "Pesan belum terkirim. Periksa internet lalu coba kirim lagi.",
  searchUsers: "Daftar pegawai belum bisa dimuat. Coba ketik nama lagi.",
  createConversation:
    "Chat baru belum bisa dibuat. Coba tekan Mulai Chat lagi.",
  sendBroadcast:
    "Broadcast belum terkirim. Periksa internet lalu coba kirim lagi.",
} as const;

/**
 * Hasil panggilan API chat: data saat berhasil, kalimat galat saat gagal.
 * Kedua cabang menyebut `data` dan `message` karena proyek ini memakai
 * `strictNullChecks: false`, yang membuat `!result.isOk` tidak menyempitkan tipe.
 */
export type ChatApiResult<T> =
  | { isOk: true; data: T; message?: undefined }
  | { isOk: false; message: string; data?: undefined };

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function readEnvelope<T>(
  response: Response,
): Promise<ApiEnvelope<T> | null> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

/** Memanggil API chat dan mengubah setiap kegagalan menjadi kalimat untuk pengguna. */
export async function requestChatApi<T>(
  url: string,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<ChatApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { isOk: false, message: CHAT_NETWORK_ERROR_MESSAGE };
  }

  const envelope = await readEnvelope<T>(response);
  if (!response.ok) {
    const serverMessage = envelope?.error?.trim();
    return { isOk: false, message: serverMessage || fallbackMessage };
  }
  return { isOk: true, data: envelope?.data as T };
}

/** Mengambil detail percakapan beserta pesan terbarunya. */
export function fetchConversationDetail(
  conversationId: string,
): Promise<ChatApiResult<ChatConversationDetail>> {
  return requestChatApi<ChatConversationDetail>(
    `/api/admin/chat/conversations/${conversationId}`,
    CHAT_FALLBACK_MESSAGES.loadMessages,
  );
}

/** Mengirim pesan teks ke sebuah percakapan. */
export function postChatMessage(
  conversationId: string,
  content: string,
): Promise<ChatApiResult<ChatMessage>> {
  return requestChatApi<ChatMessage>(
    `/api/admin/chat/conversations/${conversationId}`,
    CHAT_FALLBACK_MESSAGES.sendMessage,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ content }),
    },
  );
}

/** Mencari pegawai yang bisa diajak chat. */
export function searchChatUsers(
  searchTerm: string,
): Promise<ChatApiResult<ChatUser[]>> {
  return requestChatApi<ChatUser[]>(
    `/api/admin/chat/users?search=${encodeURIComponent(searchTerm)}`,
    CHAT_FALLBACK_MESSAGES.searchUsers,
  );
}

/** Membuat percakapan baru (atau mendapatkan yang sudah ada) dengan peserta terpilih. */
export function createChatConversation(
  participantIds: string[],
): Promise<ChatApiResult<{ id: string; isExisting: boolean }>> {
  return requestChatApi<{ id: string; isExisting: boolean }>(
    "/api/admin/chat/conversations",
    CHAT_FALLBACK_MESSAGES.createConversation,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ participantIds }),
    },
  );
}

/** Mengirim broadcast ke Global Chat. */
export function postChatBroadcast(input: {
  title?: string;
  content: string;
}): Promise<ChatApiResult<unknown>> {
  return requestChatApi<unknown>(
    "/api/admin/chat/broadcast",
    CHAT_FALLBACK_MESSAGES.sendBroadcast,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) },
  );
}
