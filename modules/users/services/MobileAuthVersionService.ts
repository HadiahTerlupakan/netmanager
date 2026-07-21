import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileTokenDetails,
  signMobileRefreshToken,
  signMobileToken,
  verifyMobileRefreshToken,
} from "@/lib/mobile-auth";
import type { MobileLoginPayload } from "./MobileAuthRouteService";

const MIN_NATIVE_VERSION_CODE = Number(
  process.env.MOBILE_MIN_NATIVE_VERSION_CODE ?? "0",
);

/** Mengelola validasi versi native aplikasi mobile dan refresh token. */
export class MobileAuthVersionService {
  /**
   * Bangun response error bila versi native aplikasi tidak lagi didukung.
   * Update OTA (JS bundle) di-handle oleh expo-updates di sisi mobile;
   * server hanya gating versi native (Play Store / sideload APK) lewat env var.
   */
  async buildUnsupportedVersionResponse(versionCode: number) {
    if (
      MIN_NATIVE_VERSION_CODE <= 0 ||
      versionCode >= MIN_NATIVE_VERSION_CODE
    ) {
      return null;
    }

    return apiError(
      "Aplikasi harus diperbarui ke versi terbaru.",
      ErrorCodes.APP_VERSION_UNSUPPORTED,
      {
        status: 426,
        details: {
          currentVersionCode: versionCode,
          minimumVersionCode: MIN_NATIVE_VERSION_CODE,
        },
      },
    );
  }

  /** Resolve detail refresh token dengan optional version override. */
  async resolveRefreshDetails(
    refreshToken: string,
    versionCodeOverride?: number,
  ) {
    if (versionCodeOverride === undefined) {
      return getMobileTokenDetails(refreshToken);
    }
    return getMobileTokenDetails(refreshToken, versionCodeOverride);
  }

  /** Verify refresh token mobile dengan optional version override. */
  async resolveMobileRefreshPayload(
    refreshToken: string,
    versionCodeOverride?: number,
  ) {
    if (versionCodeOverride === undefined) {
      return verifyMobileRefreshToken(refreshToken);
    }
    return verifyMobileRefreshToken(refreshToken, versionCodeOverride);
  }

  /** Bangun token baru dari refresh payload mobile employee. */
  async buildMobileRefreshResult(
    payload: NonNullable<Awaited<ReturnType<typeof verifyMobileRefreshToken>>>,
    details: NonNullable<Awaited<ReturnType<typeof getMobileTokenDetails>>>,
  ) {
    const trustedVersionCode = resolveTrustedMobileRefreshVersion(
      payload.appVersionCode,
      details.versionCode,
    );
    const unsupportedResponse =
      await this.buildUnsupportedVersionResponse(trustedVersionCode);
    if (unsupportedResponse) {
      return {
        kind: "unsupported" as const,
        details: { ...details, versionCode: trustedVersionCode },
      };
    }

    const tokenPayload = {
      ...payload,
      appVersionCode: trustedVersionCode || payload.appVersionCode || 0,
      appVersionName: payload.appVersionName ?? null,
    };

    return {
      kind: "success" as const,
      token: await signMobileToken(tokenPayload),
      refreshToken: await signMobileRefreshToken(tokenPayload),
    };
  }
}

/** Bangun metadata versi aplikasi dari payload login. */
export function buildVersionMetadata(input: MobileLoginPayload) {
  return {
    appVersionCode: input.versionCode || undefined,
    appVersionName: input.versionName || null,
  };
}

export function buildVersionUpdate(input: {
  versionCode: number;
  versionName?: string | null;
  otaUpdateId?: string | null;
}) {
  return {
    lastVersionCode: input.versionCode,
    lastVersionName: input.versionName || null,
    lastOtaUpdateId: normalizeOtaUpdateId(input.otaUpdateId),
    lastVersionUpdate: new Date(),
    lastLoginAt: new Date(),
  };
}

export function normalizeOtaUpdateId(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed === "embedded") return "embedded";
  return trimmed.slice(0, 64);
}

function resolveTrustedMobileRefreshVersion(
  payloadVersionCode: number | null | undefined,
  detailsVersionCode: number,
) {
  const candidateVersionCode = Number(payloadVersionCode ?? 0);
  if (Number.isInteger(candidateVersionCode) && candidateVersionCode > 0) {
    return candidateVersionCode;
  }
  return detailsVersionCode;
}
