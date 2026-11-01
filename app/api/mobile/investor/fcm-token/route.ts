import { NextResponse } from "next/server";

import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireInvestorMobileSession } from "@/lib/mobile-investor-auth";
import { getInvestorPushService } from "@/modules/investor";
import { fcmTokenRequestSchema } from "@/modules/notification";
import { limitFcmTokenRequest } from "../../fcm-token-rate-limit";

/** Daftarkan (`add`) atau lepas (`remove`) token FCM HP investor yang login. */
export async function POST(request: Request) {
  const session = await requireInvestorMobileSession(request);
  if (session instanceof NextResponse) return session;

  const limited = limitFcmTokenRequest({ kind: "investor", id: session.id });
  if (limited) return limited;

  const body: unknown = await request.json().catch((): null => null);
  const parsed = fcmTokenRequestSchema.safeParse(body);
  if (!parsed.success) return ApiErrors.badRequest("fcmToken tidak valid");

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
