import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  CUSTOMER_DISMANTLED_CODE,
  CUSTOMER_DISMANTLED_MESSAGE,
} from "@/lib/customer-portal-access";
import { getMobileRequestVersionReport } from "@/lib/mobile-api-auth";
import { getClientIP } from "@/lib/rate-limit";
import {
  evaluateMobileVersion,
  getMinimumMobileVersion,
} from "@/modules/app-version";
import { getMobileInvestorAuthService } from "@/modules/investor";
import {
  recordOutdatedAppRejected,
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

    const versionReport = getMobileRequestVersionReport(request);
    if (typeof body?.otaUpdateId === "string" && body.otaUpdateId.trim()) {
      versionReport.otaUpdateId = body.otaUpdateId.trim();
    }
    if (typeof body?.versionName === "string" && body.versionName.trim()) {
      versionReport.versionName = body.versionName.trim();
    }

    const customerTokens = await tryRefreshCustomerToken(refreshToken);
    if (customerTokens?.kind === "unsupported") {
      return customerTokens.response;
    }

    // Status dan bentuk sama dengan refresh token tidak sah (401), supaya
    // aplikasi lama tetap keluar; pesan dan kodenya yang menjelaskan.
    if (customerTokens?.kind === "dismantled") {
      return apiError(CUSTOMER_DISMANTLED_MESSAGE, CUSTOMER_DISMANTLED_CODE, {
        status: 401,
      });
    }

    if (customerTokens?.kind === "success") {
      return NextResponse.json({
        success: true,
        token: customerTokens.token,
        refreshToken: customerTokens.refreshToken,
      });
    }

    const investorTokens = await getMobileInvestorAuthService().refresh(
      refreshToken,
      versionReport,
    );
    if (investorTokens) {
      // Akses investor hanya 15 menit, jadi menolak refresh sudah cukup untuk
      // menghentikan aplikasi investor versi lama.
      const { isSupported, minimum } = await evaluateMobileVersion({
        versionCode: versionReport.versionCode ?? 0,
        versionName: versionReport.versionName ?? null,
      });
      if (!isSupported) {
        recordOutdatedAppRejected({
          stage: "refresh",
          account: null,
          version: {
            versionCode: versionReport.versionCode ?? 0,
            versionName: versionReport.versionName,
          },
          minimum,
          origin: requestOrigin(request),
        });
        return apiError(
          "Aplikasi harus diperbarui untuk melanjutkan.",
          ErrorCodes.APP_VERSION_UNSUPPORTED,
          {
            status: 426,
            details: {
              currentVersionCode: versionReport.versionCode ?? 0,
              minimumVersionCode: minimum?.versionCode ?? 0,
            },
          },
        );
      }
      return NextResponse.json({ success: true, ...investorTokens });
    }

    const mobileTokens = await tryRefreshMobileToken(
      refreshToken,
      versionReport.versionCode,
      versionReport,
    );
    if (mobileTokens.kind === "unsupported") {
      const claims = mobileTokens.details.payload;
      recordOutdatedAppRejected({
        stage: "refresh",
        identifier: typeof claims.email === "string" ? claims.email : null,
        account: {
          id: String(claims.sub ?? claims.id ?? ""),
          role: claims.role,
        },
        version: {
          versionCode: mobileTokens.details.versionCode,
          versionName:
            typeof claims.appVersionName === "string"
              ? claims.appVersionName
              : versionReport.versionName,
        },
        minimum: await getMinimumMobileVersion(),
        origin: requestOrigin(request),
      });
      return apiError(
        "Aplikasi harus diperbarui untuk melanjutkan.",
        ErrorCodes.APP_VERSION_UNSUPPORTED,
        {
          status: 426,
          details: {
            currentVersionCode: mobileTokens.details.versionCode,
            minimumVersionCode:
              mobileTokens.details.versionAccess.minimumVersionCode,
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
    logger.error("Mobile Refresh Error:", error);
    return apiError(
      "Terjadi kesalahan server. Silakan coba lagi.",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

function requestOrigin(request: NextRequest) {
  return {
    ipAddress: getClientIP(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
