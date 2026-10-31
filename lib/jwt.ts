import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
/**
 * Klien tanpa isolasi tenant — disengaja.
 *
 * Fungsi-fungsi token pelanggan di berkas ini berjalan SEBELUM ada sesi:
 * saat login, saat menukar refresh token, dan saat logout. Konteks tenant
 * pada titik itu hanya bisa berasal dari header Host, sehingga klien
 * `prisma` yang berpenjaga menolak `Pelanggan.update` dengan
 * `TenantContextError` dan login pelanggan berakhir 500 — persis yang terjadi
 * saat aplikasi mobile memanggil lewat host yang tidak terpetakan.
 *
 * Aman karena `pelangganId` di sini selalu berasal dari kredensial atau token
 * yang sudah diverifikasi, bukan dari parameter yang dikirim pemanggil; sama
 * seperti `MobileCustomerAuthService` yang memang sudah memakai `prismaAuth`.
 */
import { prismaAuth as prisma } from "./prisma";
import { canUseCustomerPortal } from "./customer-portal-access";
import {
  isPelangganSessionRevoked,
  markPelangganSessionRevoked,
} from "./pelanggan-session-revocation";

interface PelangganJWTPayload {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: string;
  appVersionCode?: number;
  appVersionName?: string | null;
  tenantId?: string | null;
  sid?: string;
  iat?: number;
  exp?: number;
}

/**
 * `sid` menandai satu sesi login (satu perangkat) dan tetap sama saat refresh
 * token diputar, supaya logout bisa mengakhiri perangkat itu saja. Token yang
 * terbit sebelum ada `sid` tidak membawanya.
 */
interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
  type: "refresh";
  sid?: string;
  appVersionCode?: number;
  appVersionName?: string | null;
  iat?: number;
  exp?: number;
}

interface PelangganVersionMetadata {
  appVersionCode?: number;
  appVersionName?: string | null;
}

const getJwtSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[SECURITY] NEXTAUTH_SECRET environment variable is required in production!",
      );
    }
    logger.warn(
      "[SECURITY] Using development-only JWT secret. Set NEXTAUTH_SECRET in production.",
    );
    return "development-only-secret-do-not-use-in-production";
  }
  return secret;
};

const JWT_EXPIRES_IN = "15m"; // 15 menit untuk access token
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const JWT_ISSUER = "netmanager";
const JWT_AUDIENCE = "pelanggan-portal";

/**
 * Generate access token untuk pelanggan
 */
export function generatePelangganAccessToken(
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    status: string;
    appVersionCode?: number;
    appVersionName?: string | null;
    tenantId?: string | null;
    sessionId?: string;
  },
  expiresIn: string | number = JWT_EXPIRES_IN,
): string {
  const payload: PelangganJWTPayload = {
    id: pelanggan.id,
    idPelanggan: pelanggan.idPelanggan,
    nama: pelanggan.nama,
    username: pelanggan.username,
    status: pelanggan.status,
    appVersionCode: pelanggan.appVersionCode,
    appVersionName: pelanggan.appVersionName,
    tenantId: pelanggan.tenantId,
    sid: pelanggan.sessionId,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/** Id baru untuk satu sesi login pelanggan. */
export function createPelangganSessionId(): string {
  return randomUUID();
}

/**
 * Generate refresh token untuk pelanggan.
 *
 * Sengaja TIDAK menaikkan `tokenVersion`: dulu setiap login dan refresh
 * menaikkannya, sehingga login di portal web mengeluarkan aplikasi mobile
 * (dan sebaliknya) pada refresh berikutnya. `tokenVersion` kini hanya naik
 * saat semua sesi memang harus dicabut (ganti password).
 */
export async function generatePelangganRefreshToken(
  pelangganId: string,
  versionMetadata: PelangganVersionMetadata | undefined,
  sessionId: string,
): Promise<string> {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: {
      tokenVersion: true,
      lastVersionCode: true,
      lastVersionName: true,
    },
  });

  const payload: RefreshTokenPayload = {
    id: pelangganId,
    tokenVersion: pelanggan?.tokenVersion || 1,
    type: "refresh",
    appVersionCode:
      versionMetadata?.appVersionCode ??
      pelanggan?.lastVersionCode ??
      undefined,
    appVersionName:
      versionMetadata?.appVersionName ?? pelanggan?.lastVersionName ?? null,
    sid: sessionId,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Verify access token pelanggan
 */
export function verifyPelangganAccessToken(
  token: string,
): PelangganJWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as PelangganJWTPayload;

    return decoded;
  } catch (error) {
    logger.error("JWT verification error:", error);
    return null;
  }
}

/**
 * Verify refresh token pelanggan
 */
export async function verifyPelangganRefreshToken(token: string): Promise<{
  id: string;
  valid: boolean;
  appVersionCode?: number;
  appVersionName?: string | null;
  sessionId?: string;
}> {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as RefreshTokenPayload;

    if (decoded.type !== "refresh") {
      return { id: "", valid: false };
    }

    // Cek token version di database
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, status: true },
    });

    if (!pelanggan || !canUseCustomerPortal(pelanggan.status)) {
      return { id: "", valid: false };
    }

    // Bandingkan token version
    if (pelanggan.tokenVersion !== decoded.tokenVersion) {
      return { id: "", valid: false };
    }

    if (decoded.sid && (await isPelangganSessionRevoked(decoded.sid))) {
      return { id: "", valid: false };
    }

    return {
      id: decoded.id,
      valid: true,
      appVersionCode: decoded.appVersionCode,
      appVersionName: decoded.appVersionName ?? null,
      sessionId: decoded.sid,
    };
  } catch (error) {
    logger.debug("Refresh token verification (customer path):", error);
    return { id: "", valid: false };
  }
}

/**
 * Generate token pair (access + refresh)
 */
export async function generatePelangganTokenPair(
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    status: string;
    tenantId?: string | null;
  } & PelangganVersionMetadata,
) {
  const sessionId = createPelangganSessionId();
  const accessToken = generatePelangganAccessToken({ ...pelanggan, sessionId });
  const refreshToken = await generatePelangganRefreshToken(
    pelanggan.id,
    {
      appVersionCode: pelanggan.appVersionCode,
      appVersionName: pelanggan.appVersionName,
    },
    sessionId,
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    tokenType: "Bearer",
  };
}

/**
 * Invalidate all refresh tokens for a pelanggan
 */
export async function invalidatePelangganRefreshTokens(pelangganId: string) {
  // Increment token version untuk invalidate semua refresh token lama
  await prisma.pelanggan.update({
    where: { id: pelangganId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * Logout satu perangkat dari token miliknya (refresh atau access token).
 * Mengembalikan false bila token bukan token pelanggan, supaya endpoint
 * logout bersama bisa meneruskannya ke jalur akun lain.
 *
 * Token kedaluwarsa tetap diterima selama tandatangannya sah: logout dengan
 * access token yang sudah lewat 15 menit harus tetap mengakhiri sesinya, dan
 * yang dicabut hanya sesi token itu sendiri.
 */
export async function revokePelangganSession(token: string): Promise<boolean> {
  let decoded: { id?: string; sid?: string; exp?: number };
  try {
    decoded = jwt.verify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      ignoreExpiration: true,
    }) as { id?: string; sid?: string; exp?: number };
  } catch {
    return false;
  }
  if (!decoded.id) return false;

  if (!decoded.sid) {
    // Token lama tanpa `sid` tidak bisa dicabut sendiri; cabut semua sesi
    // seperti perilaku logout sebelumnya. Token lama yang sudah kedaluwarsa
    // tidak berhak mengeluarkan perangkat lain.
    if (isExpired(decoded.exp)) return true;
    await invalidatePelangganRefreshTokens(decoded.id);
    return true;
  }

  try {
    await markPelangganSessionRevoked(decoded.sid, REFRESH_TOKEN_TTL_SECONDS);
  } catch (error) {
    // Logout harus mengakhiri perangkat ini apa pun yang terjadi; bila sesinya
    // tidak bisa dicatat, cabut semua sesi daripada membiarkannya hidup.
    logger.warn(
      "[PelangganSession] Gagal mencatat logout; semua sesi dicabut",
      error,
    );
    await invalidatePelangganRefreshTokens(decoded.id);
  }
  return true;
}

function isExpired(exp: number | undefined) {
  return typeof exp === "number" && exp * 1000 <= Date.now();
}
