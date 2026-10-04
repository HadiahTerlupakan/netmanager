import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { describeApiError } from "./legal-format";
import type { ApiEnvelope } from "./legal-types";

/** Status HTTP konflik (mis. nama template sudah dipakai). */
export const HTTP_CONFLICT = 409;

const NETWORK_ERROR_STATUS = 0;
const NETWORK_ERROR_MESSAGE = "Terjadi kesalahan jaringan";

/** Hasil permintaan API legal: data, atau status + pesan galat siap tampil. */
export type LegalRequestResult<T> =
  | { kind: "success"; data: T }
  | { kind: "failure"; status: number; message: string };

/**
 * Kirim permintaan ke API legal tanpa efek tampilan, agar pemanggil bisa
 * menampilkan galat tertentu (mis. 409) di dekat isian yang bermasalah.
 */
export async function requestLegalApi<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<LegalRequestResult<T>> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

    if (!response.ok || body.success === false || body.data === undefined) {
      return {
        kind: "failure",
        status: response.status,
        message: describeApiError(body, fallbackMessage),
      };
    }

    return { kind: "success", data: body.data };
  } catch (error) {
    clientLogger.error("[Legal] permintaan gagal:", error);
    return { kind: "failure", status: NETWORK_ERROR_STATUS, message: NETWORK_ERROR_MESSAGE };
  }
}

/**
 * Pengiriman mutasi ke API legal. Galat server ditampilkan lewat toast dan
 * hasilnya `null`, sehingga pemanggil cukup memeriksa hasil kosong.
 */
export async function sendLegalRequest<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T | null> {
  const result = await requestLegalApi<T>(url, init, fallbackMessage);
  if (result.kind === "success") return result.data;

  toast.error(result.message);
  return null;
}

/** Opsi fetch untuk badan JSON. */
export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
