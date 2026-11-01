"use client";

import { OFFLINE_MESSAGE } from "./inventoryRequestMessages";

export { OFFLINE_MESSAGE };

const UNREADABLE_REPLY_MESSAGE =
  "Server sedang bermasalah, jawabannya tidak terbaca. Periksa daftarnya dulu: kalau catatan Anda sudah muncul, jangan disimpan lagi. Kalau belum, coba lagi sebentar lagi.";

const SESSION_EXPIRED_STATUS = 401;
const SESSION_EXPIRED_MESSAGE =
  "Sesi login Anda sudah habis. Silakan login lagi, lalu ulangi.";

/** Error yang pesannya sudah siap dibaca staf. */
export class InventoryRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "InventoryRequestError";
  }
}

/**
 * Kirim permintaan ke API inventory dan kembalikan `data` dari jawabannya.
 * Bila gagal, lempar {@link InventoryRequestError} berisi pesan server — yang
 * sudah ditulis untuk staf — atau pesan jelas untuk internet putus, sesi habis,
 * dan jawaban server yang tidak terbaca. `fallbackMessage` hanya dipakai bila
 * server menolak tanpa pesan.
 */
export async function sendInventoryRequest<T>(
  url: string,
  init: { method: "POST" | "PUT" | "DELETE"; body?: unknown },
  fallbackMessage: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: { "Content-Type": "application/json" },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new InventoryRequestError(OFFLINE_MESSAGE, 0);
  }

  const reply: unknown = await response.json().catch((): null => null);
  if (!response.ok) {
    throw new InventoryRequestError(
      describeRejection(response.status, reply, fallbackMessage),
      response.status,
    );
  }
  if (reply === null) {
    throw new InventoryRequestError(UNREADABLE_REPLY_MESSAGE, response.status);
  }

  const envelope = reply as { data?: unknown };
  return (envelope.data ?? reply) as T;
}

function describeRejection(
  status: number,
  reply: unknown,
  fallbackMessage: string,
): string {
  const serverMessage = (reply as { error?: unknown } | null)?.error;
  if (typeof serverMessage === "string" && serverMessage) return serverMessage;
  if (status === SESSION_EXPIRED_STATUS) return SESSION_EXPIRED_MESSAGE;
  if (reply === null) return UNREADABLE_REPLY_MESSAGE;
  return fallbackMessage;
}

/**
 * Ambil pesan untuk staf dari error yang tertangkap di layar. Hanya
 * {@link InventoryRequestError} yang pesannya dipercaya; error lain (bug kode,
 * pesan teknis berbahasa Inggris) diganti `fallback`.
 */
export function describeInventoryError(
  error: unknown,
  fallback: string,
): string {
  return error instanceof InventoryRequestError ? error.message : fallback;
}
