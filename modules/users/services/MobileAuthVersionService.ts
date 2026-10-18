import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileTokenDetails,
  signMobileRefreshToken,
  signMobileToken,
  verifyMobileRefreshToken,
} from "@/lib/mobile-auth";
import type { MobileLoginPayload } from "./MobileAuthRouteService";

/**
 * Klaim yang dibawa token mobile: sama dengan yang ditulis saat login
 * karyawan dan mitra. Izin, site, dan data lain dibaca ulang dari database di
 * setiap request, jadi tidak perlu ikut ditandatangani. Dulu payload hasil
 * verifikasi (lengkap dengan seluruh izin peran) ikut ke token baru; peran
 * dengan 1.046 izin menghasilkan header Authorization ~43 KB dan server
 * membalas 431 untuk setiap request sesudah refresh pertama.
 */
const IDENTITY_CLAIMS = [
  "sub",
  "id",
  "email",
  "name",
  "role",
  "mitraType",
  "tenantId",
  "isSuperAdmin",
  "accessAdminPanel",
  "appVersionName",
] as const;

function pickIdentityClaims(payload: Record<string, unknown>) {
  return Object.fromEntries(
    IDENTITY_CLAIMS.filter((claim) => payload[claim] !== undefined).map(
      (claim) => [claim, payload[claim]],
    ),
  );
}

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
      ...pickIdentityClaims(payload),
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

/** Masukan pencatatan versi aplikasi dari payload login. */
interface MasukanVersi {
  versionCode: number;
  versionName?: string | null;
  otaUpdateId?: string | null;
}

/**
 * Medan versi yang ada di `Pelanggan` MAUPUN `User`.
 *
 * Dipisahkan dari versi `User` karena keduanya sempat memakai satu fungsi yang
 * ikut menulis `lastOtaUpdateId` dan `lastLoginAt` — dua kolom yang hanya ada
 * di `User`. Akibatnya setiap login pelanggan melempar validasi Prisma dan
 * route menjawab 500: tidak satu pun pelanggan bisa membuka aplikasi.
 * TypeScript tidak menangkapnya, dan tidak akan: hasil pemanggilan fungsi
 * tidak kena pemeriksaan properti berlebih, dan assignability struktural pun
 * mengizinkan medan tambahan. Penjaganya ada di
 * `tests/modules/users/mobile-version-update-kolom.test.ts`, yang mencocokkan
 * kunci hasil fungsi ini dengan kolom asli kedua model.
 */
export interface MedanVersiBersama {
  lastVersionCode: number;
  lastVersionName: string | null;
  lastVersionUpdate: Date;
}

export function buildVersionUpdate(input: MasukanVersi): MedanVersiBersama {
  return {
    lastVersionCode: input.versionCode,
    lastVersionName: input.versionName || null,
    lastVersionUpdate: new Date(),
  };
}

/** Medan versi khusus `User`; `Pelanggan` tidak punya kedua kolom tambahan ini. */
export interface MedanVersiPengguna extends MedanVersiBersama {
  lastOtaUpdateId: string | null;
  lastLoginAt: Date;
}

/** Medan versi untuk `User`: menambah jejak OTA dan waktu login terakhir. */
export function buildVersionUpdatePengguna(
  input: MasukanVersi,
): MedanVersiPengguna {
  return {
    ...buildVersionUpdate(input),
    lastOtaUpdateId: normalizeOtaUpdateId(input.otaUpdateId),
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
