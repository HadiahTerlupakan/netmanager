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
import { getAppVersionService } from "@/modules/app-version";

async function buildUnsupportedVersionResponse(versionCode: number) {
  const versionAccess =
    await getAppVersionService().evaluateVersionAccess(versionCode);

  if (versionAccess.isSupported) {
    return null;
  }

  return apiError(
    "Aplikasi harus diperbarui untuk melanjutkan.",
    ErrorCodes.APP_VERSION_UNSUPPORTED,
    {
      status: 426,
      details: {
        currentVersionCode: versionCode,
        minimumVersion: versionAccess.minimumVersion,
        latestVersion: versionAccess.latestVersion,
        isForceUpdate: versionAccess.isForceUpdate,
        updateAvailable: versionAccess.updateAvailable,
      },
    },
  );
}

function resolveTrustedCustomerVersion(
  verified: Awaited<ReturnType<typeof verifyPelangganRefreshToken>>,
  customer: {
    lastVersionCode: number | null;
    lastVersionName: string | null;
  },
) {
  const tokenVersionCode = verified.appVersionCode ?? 0;
  const persistedVersionCode = customer.lastVersionCode ?? 0;
  const shouldUsePersistedVersion = persistedVersionCode > tokenVersionCode;

  if (shouldUsePersistedVersion) {
    return {
      trustedVersionCode: persistedVersionCode,
      trustedVersionName:
        customer.lastVersionName ?? verified.appVersionName ?? null,
    };
  }

  return {
    trustedVersionCode:
      verified.appVersionCode ?? customer.lastVersionCode ?? 0,
    trustedVersionName:
      verified.appVersionName ?? customer.lastVersionName ?? null,
  };
}

async function tryRefreshCustomerToken(refreshToken: string) {
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
      lastVersionCode: true,
      lastVersionName: true,
    },
  });

  if (!customer || customer.status !== "AKTIF") {
    return null;
  }

  const { trustedVersionCode, trustedVersionName } =
    resolveTrustedCustomerVersion(verified, customer);

  const unsupportedVersionResponse =
    await buildUnsupportedVersionResponse(trustedVersionCode);
  if (unsupportedVersionResponse) {
    return {
      kind: "unsupported" as const,
      response: unsupportedVersionResponse,
    };
  }

  const token = generatePelangganAccessToken(
    {
      id: customer.id,
      idPelanggan: customer.idPelanggan,
      nama: customer.nama,
      username: customer.username,
      status: customer.status,
      tenantId: customer.tenantId,
      appVersionCode: trustedVersionCode || undefined,
      appVersionName: trustedVersionName,
    },
    "7d",
  );
  const nextRefreshToken = await generatePelangganRefreshToken(customer.id, {
    appVersionCode: trustedVersionCode || undefined,
    appVersionName: trustedVersionName,
  });

  return {
    kind: "success" as const,
    token,
    refreshToken: nextRefreshToken,
  };
}

async function tryRefreshMobileToken(refreshToken: string) {
  const details = await getMobileTokenDetails(refreshToken);
  if (!details) {
    return { kind: "invalid" as const };
  }

  if (!details.versionAccess.isSupported) {
    return {
      kind: "unsupported" as const,
      details,
    };
  }

  const payload = await verifyMobileRefreshToken(refreshToken);
  if (!payload) {
    return { kind: "invalid" as const };
  }

  const tokenPayload = {
    ...payload,
    appVersionCode: details.versionCode || payload.appVersionCode || 0,
    appVersionName: payload.appVersionName ?? null,
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

    const mobileTokens = await tryRefreshMobileToken(refreshToken);
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
