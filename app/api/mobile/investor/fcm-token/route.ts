import { NextResponse } from "next/server";
import { z } from "zod";

import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireInvestorMobileSession } from "@/lib/mobile-investor-auth";
import { getInvestorPushService } from "@/modules/investor";

/** Token FCM perangkat jauh di bawah 4096 karakter; batas mencegah sampah besar. */
const PANJANG_TOKEN_MAKS = 4096;

const fcmTokenSchema = z.object({
  fcmToken: z.string().trim().min(1).max(PANJANG_TOKEN_MAKS),
  action: z.enum(["add", "remove"]).default("add"),
});

/** Daftarkan (`add`) atau lepas (`remove`) token FCM HP investor yang login. */
export async function POST(request: Request) {
  const session = await requireInvestorMobileSession(request);
  if (session instanceof NextResponse) return session;

  const body: unknown = await request.json().catch((): null => null);
  const parsed = fcmTokenSchema.safeParse(body);
  if (!parsed.success) return ApiErrors.badRequest("fcmToken wajib diisi");

  try {
    const isTersimpan = await getInvestorPushService().aturToken(
      session.id,
      parsed.data.fcmToken,
      parsed.data.action,
    );
    if (!isTersimpan) return ApiErrors.notFound("Investor");
    return apiSuccess(null, { message: "Token notifikasi tersimpan" });
  } catch (error) {
    logger.error("[MOBILE_INVESTOR] fcm-token gagal:", error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}
