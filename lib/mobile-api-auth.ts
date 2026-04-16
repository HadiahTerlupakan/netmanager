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

  const details = await getMobileTokenDetails(token);
  if (!details) {
    return { response: unauthorizedResponse("Token tidak valid") };
  }

  const payload = await verifyMobileToken(token);
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
            minimumVersion: details.versionAccess.minimumVersion,
            latestVersion: details.versionAccess.latestVersion,
            isForceUpdate: details.versionAccess.isForceUpdate,
            updateAvailable: details.versionAccess.updateAvailable,
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
