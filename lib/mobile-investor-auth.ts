import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getMobileJwtSecret, MOBILE_JWT_ISSUER } from "@/lib/mobile-auth";
import { prismaAuth } from "@/lib/prisma";

/**
 * Token aplikasi mobile untuk akun investor.
 *
 * Investor bukan `User`, jadi tokennya memakai audience sendiri: verifier
 * mobile karyawan/mitra/pelanggan (`verifyMobileToken`) menolaknya, dan
 * endpoint investor hanya menerima token beraudience ini. Akibatnya token
 * investor tidak pernah bisa membuka endpoint karyawan walau tenant sama.
 */

export const INVESTOR_MOBILE_ROLE = "INVESTOR";
const INVESTOR_MOBILE_AUDIENCE = "netmanager-investor-mobile";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
const BEARER_PREFIX = "Bearer ";

type JenisTokenInvestor = "access" | "refresh";

/** Identitas investor yang dibutuhkan untuk menerbitkan token. */
export interface InvestorMobileIdentity {
  id: string;
  username: string;
  namaLengkap: string;
  tenantId: string | null;
  tokenVersion: number;
}

/** Sesi investor hasil verifikasi token mobile. */
export interface InvestorMobileSession {
  id: string;
  username: string;
  namaLengkap: string;
  tenantId: string | null;
}

/** Versi aplikasi pelapor saat login/refresh, disimpan di klaim token. */
export interface VersiAplikasiInvestor {
  versionCode?: number;
  versionName?: string | null;
}

interface KlaimTokenInvestor extends JWTPayload {
  id: string;
  username: string;
  namaLengkap: string;
  role: string;
  tenantId: string | null;
  tokenVersion: number;
  type: JenisTokenInvestor;
}

function isKlaimTokenInvestor(payload: JWTPayload): payload is KlaimTokenInvestor {
  return (
    typeof payload.id === "string" &&
    typeof payload.username === "string" &&
    typeof payload.namaLengkap === "string" &&
    typeof payload.tokenVersion === "number" &&
    payload.role === INVESTOR_MOBILE_ROLE
  );
}

async function tandatanganiToken(
  identity: InvestorMobileIdentity,
  type: JenisTokenInvestor,
  versi: VersiAplikasiInvestor,
) {
  return new SignJWT({
    id: identity.id,
    username: identity.username,
    namaLengkap: identity.namaLengkap,
    name: identity.namaLengkap,
    role: INVESTOR_MOBILE_ROLE,
    tenantId: identity.tenantId,
    tokenVersion: identity.tokenVersion,
    type,
    appVersionCode: versi.versionCode ?? null,
    appVersionName: versi.versionName ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.id)
    .setIssuer(MOBILE_JWT_ISSUER)
    .setAudience(INVESTOR_MOBILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(type === "refresh" ? REFRESH_TOKEN_TTL : ACCESS_TOKEN_TTL)
    .sign(getMobileJwtSecret());
}

/** Menerbitkan pasangan access + refresh token investor mobile. */
export async function signInvestorMobileTokens(
  identity: InvestorMobileIdentity,
  versi: VersiAplikasiInvestor = {},
) {
  const [token, refreshToken] = await Promise.all([
    tandatanganiToken(identity, "access", versi),
    tandatanganiToken(identity, "refresh", versi),
  ]);
  return { token, refreshToken };
}

async function bacaKlaim(token: string): Promise<KlaimTokenInvestor | null> {
  try {
    const { payload } = await jwtVerify(token, getMobileJwtSecret(), {
      issuer: MOBILE_JWT_ISSUER,
      audience: INVESTOR_MOBILE_AUDIENCE,
    });
    return isKlaimTokenInvestor(payload) ? payload : null;
  } catch {
    // Token karyawan/mitra/pelanggan atau kedaluwarsa — bukan token investor sah.
    return null;
  }
}

/**
 * Memverifikasi token investor mobile: tanda tangan + audience, jenis token,
 * akun masih aktif, dan `tokenVersion` belum dicabut lewat logout.
 */
export async function verifyInvestorMobileToken(
  token: string,
  expectedType: JenisTokenInvestor,
): Promise<InvestorMobileSession | null> {
  const klaim = await bacaKlaim(token);
  if (!klaim || klaim.type !== expectedType) return null;

  try {
    const investor = await prismaAuth.investor.findUnique({
      where: { id: klaim.id },
      select: {
        id: true,
        username: true,
        namaLengkap: true,
        tenantId: true,
        isActive: true,
        tokenVersion: true,
      },
    });
    if (!investor?.isActive || investor.tokenVersion > klaim.tokenVersion) {
      return null;
    }
    return {
      id: investor.id,
      username: investor.username,
      namaLengkap: investor.namaLengkap,
      tenantId: investor.tenantId,
    };
  } catch (error) {
    logger.error("[MOBILE_INVESTOR_AUTH] Verifikasi token gagal:", error);
    return null;
  }
}

/** Mengambil Bearer token dari request, atau null bila tidak ada. */
export function bacaBearerToken(request: Pick<Request, "headers">): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token && token !== "null" ? token : null;
}

/** Sesi investor dari Bearer access token, atau null bila bukan token investor sah. */
export async function getInvestorMobileSession(
  request: Pick<Request, "headers">,
): Promise<InvestorMobileSession | null> {
  const token = bacaBearerToken(request);
  return token ? verifyInvestorMobileToken(token, "access") : null;
}

/**
 * Sesi investor wajib untuk endpoint `/api/mobile/investor/*`; mengembalikan
 * respons 401 bila token tidak ada/bukan token investor.
 */
export async function requireInvestorMobileSession(
  request: Pick<Request, "headers">,
): Promise<InvestorMobileSession | NextResponse> {
  const session = await getInvestorMobileSession(request);
  if (session) return session;
  return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
}
