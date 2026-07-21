import { NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileTokenDetails, verifyMobileToken } from "@/lib/mobile-auth";
import type { MobileTokenPayload } from "@/lib/mobile-auth";

interface MobileAuthSuccess {
  payload: MobileTokenPayload;
}

interface MobileAuthFailure {
  response: NextResponse;
}

export type MobileAuthResult = MobileAuthSuccess | MobileAuthFailure;

function unauthorizedResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function getMobileRequestVersionCode(
  request: Pick<Request, "headers">,
): number | undefined {
  const rawVersionCode = request.headers.get("x-app-version-code");
  if (!rawVersionCode) {
    return undefined;
  }

  const versionCode = Number(rawVersionCode);
  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    return undefined;
  }

  return versionCode;
}

export function getMobileRequestVersionReport(
  request: Pick<Request, "headers">,
): {
  versionCode?: number;
  versionName?: string | null;
  otaUpdateId?: string | null;
} {
  const versionCode = getMobileRequestVersionCode(request);
  const versionName = request.headers.get("x-app-version-name");
  const otaUpdateId = request.headers.get("x-app-ota-update-id");
  return {
    versionCode,
    versionName: versionName?.trim() || null,
    otaUpdateId: otaUpdateId?.trim() || null,
  };
}

export async function authenticateMobileRequest(
  request: Request,
): Promise<MobileAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: unauthorizedResponse("Tidak terautentikasi") };
  }

  const token = authHeader.split(" ")[1];
  if (!token || token === "null") {
    return { response: unauthorizedResponse("Token tidak tersedia") };
  }

  const versionCodeOverride = getMobileRequestVersionCode(request);

  const details =
    versionCodeOverride === undefined
      ? await getMobileTokenDetails(token)
      : await getMobileTokenDetails(token, versionCodeOverride);
  if (!details) {
    return { response: unauthorizedResponse("Token tidak valid") };
  }

  const payload =
    versionCodeOverride === undefined
      ? await verifyMobileToken(token, undefined, details)
      : await verifyMobileToken(token, versionCodeOverride, details);
  if (!payload) {
    return { response: unauthorizedResponse("Token tidak valid") };
  }

  if (!details.versionAccess.isSupported) {
    return {
      response: apiError(
        "Aplikasi harus diperbarui untuk melanjutkan.",
        ErrorCodes.APP_VERSION_UNSUPPORTED,
        {
          status: 426,
          details: {
            currentVersionCode: details.versionCode,
            minimumVersionCode: details.versionAccess.minimumVersionCode,
          },
        },
      ),
    };
  }

  return { payload };
}

export async function getMobileAuthPayload(
  request: Request,
): Promise<MobileTokenPayload | NextResponse> {
  const result = await authenticateMobileRequest(request);
  if ("response" in result) {
    return result.response;
  }

  return result.payload;
}
