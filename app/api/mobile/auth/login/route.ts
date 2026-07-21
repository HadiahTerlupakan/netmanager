import { logger } from "@/lib/logger";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { loginMobileRoute } from "@/modules/users";

/** Menangani login mobile untuk employee, customer, dan mitra. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return loginMobileRoute({
      email: body.email,
      password: body.password,
      versionCode: parseVersionCode(body.versionCode),
      versionName: body.versionName || null,
      otaUpdateId:
        typeof body.otaUpdateId === "string" ? body.otaUpdateId : null,
      loginType: body.loginType || "EMPLOYEE",
    });
  } catch (error) {
    logger.error("Mobile Login Error:", error);
    return apiError(
      "Terjadi kesalahan server. Silakan coba lagi.",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

function parseVersionCode(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
