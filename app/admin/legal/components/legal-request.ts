import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { describeApiError } from "./legal-format";
import type { ApiEnvelope } from "./legal-types";

/**
 * Pengiriman mutasi ke API legal. Galat server ditampilkan lewat toast dan
 * hasilnya `null`, sehingga pemanggil cukup memeriksa hasil kosong.
 */
export async function sendLegalRequest<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

    if (!response.ok || body.success === false || body.data === undefined) {
      toast.error(describeApiError(body, fallbackMessage));
      return null;
    }

    return body.data;
  } catch (error) {
    clientLogger.error("[Legal] permintaan gagal:", error);
    toast.error("Terjadi kesalahan jaringan");
    return null;
  }
}

/** Opsi fetch untuk badan JSON. */
export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
