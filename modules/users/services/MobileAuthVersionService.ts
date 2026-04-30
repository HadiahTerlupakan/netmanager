import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileTokenDetails,
  signMobileRefreshToken,
  signMobileToken,
  verifyMobileRefreshToken,
} from "@/lib/mobile-auth";
import { getAppVersionService } from "@/modules/app-version";
import type { MobileLoginPayload } from "./MobileAuthRouteService";

/** Mengelola validasi versi aplikasi dan refresh token mobile employee. */
export class MobileAuthVersionService {
  /** Bangun response error bila versi aplikasi tidak lagi didukung. */
  async buildUnsupportedVersionResponse(versionCode: number) {
    const versionAccess = await (
      await getAppVersionService()
    ).evaluateVersionAccess(versionCode);
    if (versionAccess.isSupported) return null;

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

/** Bangun data update versi terakhir untuk user/customer. */
export function buildVersionUpdate(input: MobileLoginPayload) {
  return {
    lastVersionCode: input.versionCode,
    lastVersionName: input.versionName || null,
    lastVersionUpdate: new Date(),
  };
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
