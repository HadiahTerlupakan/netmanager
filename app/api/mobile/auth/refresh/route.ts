import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileRequestVersionCode } from "@/lib/mobile-api-auth";
import {
  tryRefreshCustomerToken,
  tryRefreshMobileToken,
} from "@/modules/users";

/** Memperbarui token akses mobile menggunakan refresh token. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const refreshToken =
      typeof body?.refreshToken === "string" ? body.refreshToken : "";
    if (!refreshToken) {
      return apiError(
        "Refresh token harus diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const customerTokens = await tryRefreshCustomerToken(refreshToken);
    if (customerTokens?.kind === "unsupported") {
      return customerTokens.response;
    }

    if (customerTokens?.kind === "success") {
      return NextResponse.json({
        success: true,
        token: customerTokens.token,
        refreshToken: customerTokens.refreshToken,
      });
    }

    const mobileTokens = await tryRefreshMobileToken(
      refreshToken,
      getMobileRequestVersionCode(request),
    );
    if (mobileTokens.kind === "unsupported") {
      return apiError(
        "Aplikasi harus diperbarui untuk melanjutkan.",
        ErrorCodes.APP_VERSION_UNSUPPORTED,
        {
          status: 426,
          details: {
            currentVersionCode: mobileTokens.details.versionCode,
            minimumVersion: mobileTokens.details.versionAccess.minimumVersion,
            latestVersion: mobileTokens.details.versionAccess.latestVersion,
            isForceUpdate: mobileTokens.details.versionAccess.isForceUpdate,
            updateAvailable: mobileTokens.details.versionAccess.updateAvailable,
          },
        },
      );
    }

    if (mobileTokens.kind === "invalid") {
      return apiError("Refresh token tidak valid", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    return NextResponse.json({
      success: true,
      token: mobileTokens.token,
      refreshToken: mobileTokens.refreshToken,
    });
  } catch (error) {
    console.error("Mobile Refresh Error:", error);
    return apiError(
      "Terjadi kesalahan server. Silakan coba lagi.",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
