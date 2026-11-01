/**
 * Pesan error untuk layar master data inventory (barang, gudang, jasa, aset).
 * Server sudah menulis pesan yang jelas untuk staf; helper ini memastikan
 * pesan itu yang tampil, bukan teks teknis dari browser.
 */

import { OFFLINE_MESSAGE } from "@/components/inventory/form-shared/inventoryRequestMessages";

/** Pesan server dari respons gagal; `fallback` bila server tidak memberi pesan. */
export async function readApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await response.json().catch((): null => null);
  if (body && typeof body === "object") {
    const { error, message } = body as { error?: unknown; message?: unknown };
    if (typeof error === "string" && error.trim()) return error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

/**
 * Pesan untuk error yang tertangkap di layar. Gangguan jaringan diganti
 * kalimat biasa, karena browser menulisnya dalam bahasa Inggris teknis.
 */
export function describeClientError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return OFFLINE_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
