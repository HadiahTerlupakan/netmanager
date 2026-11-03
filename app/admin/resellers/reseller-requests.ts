import {
  fetchWithHandling,
  formatErrorMessage,
  isFetchError,
} from "@/lib/utils/fetch-wrapper";

/** Pesan galat untuk toast, termasuk detail validasi field dari server. */
export function getErrorMessage(error: unknown): string {
  if (isFetchError(error)) return formatErrorMessage(error);
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

/**
 * Kirim mutasi ke API reseller. `fetchWithHandling` membaca bentuk galat
 * standar `{ error, details }`, jadi alasan penolakan server sampai ke toast.
 */
export async function sendResellerMutation(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<void> {
  await fetchWithHandling(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
