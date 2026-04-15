import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { prismaAuth } from "@/modules/database";
import {
  getMobileTokenDetails,
  signMobileRefreshToken,
  signMobileToken,
  verifyMobileRefreshToken,
} from "@/lib/mobile-auth";
import {
  generatePelangganAccessToken,
  generatePelangganRefreshToken,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";

function parseVersionCode(value: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resolveVersionFromRequest(request: NextRequest) {
  const versionCode = parseVersionCode(
    request.headers.get("x-app-version-code"),
  );
  const versionName = request.headers.get("x-app-version-name");

  return {
    versionCode,
    versionName: versionName?.trim() || null,
  };
}

async function tryRefreshCustomerToken(
  refreshToken: string,
  versionCode: number,
  versionName: string | null,
) {
  const verified = await verifyPelangganRefreshToken(refreshToken);
  if (!verified.valid) {
    return null;
  }

  const customer = await prismaAuth.pelanggan.findUnique({
    where: { id: verified.id },
    select: {
      id: true,
      idPelanggan: true,
      nama: true,
      username: true,
      status: true,
      tenantId: true,
    },
  });

  if (!customer || customer.status !== "AKTIF") {
    return null;
  }

  const token = generatePelangganAccessToken(
    {
      id: customer.id,
      idPelanggan: customer.idPelanggan,
      nama: customer.nama,
      username: customer.username,
      status: customer.status,
      tenantId: customer.tenantId,
      appVersionCode: versionCode || undefined,
      appVersionName: versionName,
    },
    "7d",
  );
  const nextRefreshToken = await generatePelangganRefreshToken(customer.id);

  return {
    token,
    refreshToken: nextRefreshToken,
  };
}

async function tryRefreshMobileToken(
  refreshToken: string,
  versionCode: number,
  versionName: string | null,
) {
  const details = await getMobileTokenDetails(
    refreshToken,
    versionCode || null,
  );
  if (!details) {
    return { kind: "invalid" as const };
  }

  if (!details.versionAccess.isSupported) {
    return {
      kind: "unsupported" as const,
      details,
    };
  }

  const payload = await verifyMobileRefreshToken(
    refreshToken,
    versionCode || null,
  );
  if (!payload) {
    return { kind: "invalid" as const };
  }

  const tokenPayload = {
    ...payload,
    appVersionCode: versionCode || payload.appVersionCode || 0,
    appVersionName: versionName ?? payload.appVersionName ?? null,
  };

  const token = await signMobileToken(tokenPayload);
  const nextRefreshToken = await signMobileRefreshToken(tokenPayload);

  return {
    kind: "success" as const,
    token,
    refreshToken: nextRefreshToken,
  };
}

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

    const { versionCode, versionName } = resolveVersionFromRequest(request);

    const customerTokens = await tryRefreshCustomerToken(
      refreshToken,
      versionCode,
      versionName,
    );
    if (customerTokens) {
      return NextResponse.json({
        success: true,
        token: customerTokens.token,
        refreshToken: customerTokens.refreshToken,
      });
    }

    const mobileTokens = await tryRefreshMobileToken(
      refreshToken,
      versionCode,
      versionName,
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
