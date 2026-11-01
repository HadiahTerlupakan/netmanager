import { apiError, ErrorCodes } from "@/lib/api-response";
import type { MobileTokenPayload } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Batas permintaan token FCM per pemilik, memakai pembatas yang sama dengan
 * rute pembayaran pelanggan; kuncinya pemilik, bukan IP, karena pelanggan
 * seluler berbagi IP lewat CGNAT. Aplikasi yang sehat hanya mengirim beberapa
 * per menit (login, dibuka, token diperbarui, logout), sedangkan setiap
 * pendaftaran melepas token dari pemilik lain.
 */
const FCM_TOKEN_REQUESTS_PER_MINUTE = 10;

/** Pemilik token: pelanggan, mitra, staf, atau investor, beserta id-nya. */
export interface FcmTokenPrincipal {
  kind: "pelanggan" | "mitra" | "user" | "investor";
  id: string;
}

/** Pemilik token dari sesi mobile karyawan, mitra, atau pelanggan. */
export function mobileFcmTokenPrincipal(
  session: Pick<MobileTokenPayload, "role" | "userId">,
): FcmTokenPrincipal {
  const id = session.userId;
  if (session.role === "CUSTOMER") return { kind: "pelanggan", id };
  if (session.role === "MITRA") return { kind: "mitra", id };
  return { kind: "user", id };
}

/** Respons 429 bila pemilik ini melewati batas; null bila boleh lanjut. */
export function limitFcmTokenRequest(principal: FcmTokenPrincipal) {
  if (
    rateLimit(
      `fcm-token:${principal.kind}:${principal.id}`,
      FCM_TOKEN_REQUESTS_PER_MINUTE,
    )
  ) {
    return null;
  }

  return apiError(
    "Terlalu banyak permintaan. Coba lagi dalam 1 menit.",
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    { status: 429 },
  );
}
