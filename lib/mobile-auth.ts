import { logger } from "@/lib/logger";
import { isSuperAdminRole } from "@/lib/auth/helpers";
import { SignJWT, jwtVerify } from "jose";
import { prismaAuth } from "@/lib/prisma";
import { prismaMitraAuth } from "@/lib/prisma-mitra";

const MIN_NATIVE_VERSION_CODE = Number(
  process.env.MOBILE_MIN_NATIVE_VERSION_CODE ?? "0",
);

/** Hasil evaluasi versi native mobile.
 * OTA (JS bundle) di-handle oleh expo-updates di sisi mobile;
 * server hanya gating versi native (Play Store / sideload APK) lewat env var. */
export interface VersionAccessResult {
  isSupported: boolean;
  currentVersionCode: number;
  minimumVersionCode: number;
}

function evaluateVersionAccess(versionCode: number): VersionAccessResult {
  const isSupported =
    MIN_NATIVE_VERSION_CODE <= 0 || versionCode >= MIN_NATIVE_VERSION_CODE;
  return {
    isSupported,
    currentVersionCode: versionCode,
    minimumVersionCode: MIN_NATIVE_VERSION_CODE,
  };
}

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

async function getMobileTokenVersion(payload: Record<string, unknown>) {
  try {
    const id = (payload.id || payload.sub) as string;
    const role = payload.role as string | undefined;

    if (role === "MITRA") {
      const mitra = await prismaMitraAuth.mitra.findUnique({
        where: { id },
        select: { tokenVersion: true },
      });
      return mitra?.tokenVersion ?? 0;
    }

    if (role === "CUSTOMER") {
      const customer = await prismaAuth.pelanggan.findUnique({
        where: { id },
        select: { tokenVersion: true },
      });
      return customer?.tokenVersion ?? 0;
    }

    const user = await prismaAuth.user.findUnique({
      where: { id },
      select: { tokenVersion: true },
    });
    return user?.tokenVersion ?? 0;
  } catch (error) {
    logger.error("[MOBILE_AUTH] Error fetching tokenVersion:", error);
    return 0;
  }
}

function buildMobileJwtPayload(
  payload: Record<string, unknown>,
  tokenVersion: number,
  type?: "access" | "refresh",
) {
  const { type: _existingType, ...basePayload } = payload;

  return {
    ...basePayload,
    ...(type ? { type } : {}),
    sub: (payload.sub || payload.id) as string,
    tokenVersion,
  };
}

const MOBILE_JWT_ISSUER = "netmanager";
const MOBILE_JWT_AUDIENCE = "netmanager-mobile";

export async function signMobileToken(payload: Record<string, unknown>) {
  const tokenVersion = await getMobileTokenVersion(payload);
  const jwtPayload = buildMobileJwtPayload(payload, tokenVersion);

  return await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(MOBILE_JWT_ISSUER)
    .setAudience(MOBILE_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function signMobileRefreshToken(payload: Record<string, unknown>) {
  const tokenVersion = await getMobileTokenVersion(payload);
  const jwtPayload = buildMobileJwtPayload(payload, tokenVersion, "refresh");

  return await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(MOBILE_JWT_ISSUER)
    .setAudience(MOBILE_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export interface MobileTokenPayload {
  sub: string;
  userId: string;
  id?: string;
  name?: string;
  email?: string;
  type?: string;
  tokenVersion?: number;
  appVersionCode?: number;
  appVersionName?: string | null;
  role?: string;
  permissions?: string[];
  isSales?: boolean;
  siteId?: string | null;
  siteIds?: string[];
  tenantId?: string | null;
  isSuperAdmin?: boolean;
  accessAdminPanel?: boolean;
  [key: string]: unknown;
}

export interface MobileTokenDetails {
  payload: MobileTokenPayload;
  versionCode: number;
  versionAccess: VersionAccessResult;
}

export function getMitraMobileFeatures(mitraType?: string | null): string[] {
  return [
    "m_dashboard",
    "m_mitra_wallet",
    "m_mitra_withdraw",
    "m_chat",
    ...(mitraType === "MITRA_SALES" ? ["m_canvasing"] : []),
    ...(mitraType === "MITRA_TEKNISI"
      ? ["m_work_order", "m_barang", "m_barang_masuk", "m_barang_keluar"]
      : []),
  ];
}

export function getMitraMobileCapabilities(mitraType?: string | null): {
  features: string[];
  permissions: string[];
} {
  const features = getMitraMobileFeatures(mitraType);
  const permissions = ["m_dashboard:read", "m_chat:read", "m_chat:create"];

  if (mitraType === "MITRA_SALES") {
    permissions.push("m_canvasing:read", "m_canvasing:create");
  }

  if (mitraType === "MITRA_TEKNISI") {
    permissions.push(
      "m_work_order:read",
      "m_work_order:update",
      "m_work_order:create",
      "m_barang:read",
      "m_barang_masuk:read",
      "m_barang_masuk:create",
      "m_barang_keluar:read",
      "m_barang_keluar:create",
    );
  }

  return { features, permissions };
}

export function hasMobilePermission(
  permissions: string[] | undefined,
  requiredPermission: string,
): boolean {
  const availablePermissions = permissions ?? [];
  const featureAlias = requiredPermission.split(":")[0];

  return (
    availablePermissions.includes("*") ||
    availablePermissions.includes(requiredPermission) ||
    availablePermissions.includes(featureAlias)
  );
}

export function hasAnyMobilePermission(
  permissions: string[] | undefined,
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.some((permission) =>
    hasMobilePermission(permissions, permission),
  );
}

function resolveVersionCode(
  payload: MobileTokenPayload,
  versionCodeOverride?: number | null,
): number {
  // Source of truth: claim `appVersionCode` di JWT (signed saat login).
  // Header `X-App-Version-Code` HANYA dipakai sebagai upper-bound override
  // ketika versi token lebih lama dari versi runtime — tidak boleh dipakai
  // untuk versi yang lebih TINGGI dari token claim, karena header bisa
  // di-spoof oleh client untuk bypass version gating.
  const tokenVersionCode = Number(
    payload.appVersionCode ?? payload.versionCode ?? 0,
  );
  const safeTokenVersion =
    Number.isFinite(tokenVersionCode) && tokenVersionCode > 0
      ? tokenVersionCode
      : 0;

  if (
    typeof versionCodeOverride === "number" &&
    Number.isFinite(versionCodeOverride) &&
    versionCodeOverride > 0 &&
    versionCodeOverride <= safeTokenVersion
  ) {
    // Header diizinkan kalau lebih kecil — kasus user "downgrade" runtime
    // (mis. install APK lama) sambil token masih valid; backend harus tahu
    // versi runtime sebenarnya untuk gating.
    return versionCodeOverride;
  }

  return safeTokenVersion;
}

export async function getMobileTokenDetails(
  token: string,
  versionCodeOverride?: number | null,
): Promise<MobileTokenDetails | null> {
  try {
    // Validasi audience+issuer untuk cegah token customer-portal
    // (audience pelanggan-portal) dipakai sebagai mobile token. Tanpa
    // validasi, token cross-context bisa lolos hanya karena share
    // NEXTAUTH_SECRET.
    //
    // Graceful migration: token lama yang issued sebelum perubahan
    // tidak punya claim aud/iss. Coba strict-verify dulu; bila gagal
    // dengan reason claim mismatch, fallback ke verify tanpa aud/iss
    // sampai semua user re-login (max 30 hari refresh expire).
    let payload: MobileTokenPayload;
    try {
      const result = await jwtVerify(token, getSecret(), {
        issuer: MOBILE_JWT_ISSUER,
        audience: MOBILE_JWT_AUDIENCE,
      });
      payload = result.payload as MobileTokenPayload;
    } catch (strictError) {
      const code = (strictError as { code?: string }).code;
      const isClaimMismatch =
        code === "ERR_JWT_CLAIM_VALIDATION_FAILED" ||
        code === "ERR_JWT_CLAIM_NOT_FOUND";
      if (!isClaimMismatch) {
        throw strictError;
      }
      logger.warn(
        "[MOBILE_AUTH] Legacy token without aud/iss claim — accepting until refresh cycles complete",
      );
      const result = await jwtVerify(token, getSecret());
      payload = result.payload as MobileTokenPayload;
    }
    const mobilePayload = payload;
    const versionCode = resolveVersionCode(mobilePayload, versionCodeOverride);
    const versionAccess = evaluateVersionAccess(versionCode);

    return {
      payload: mobilePayload,
      versionCode,
      versionAccess,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED") {
      logger.warn("[MOBILE_AUTH] Token expired — client perlu refresh token");
    } else {
      logger.error("[MOBILE_AUTH] Token parsing failed:", error);
    }
    return null;
  }
}

async function verifyCustomerToken(
  userId: string,
  payload: MobileTokenPayload,
): Promise<MobileTokenPayload | null> {
  const customer = await prismaAuth.pelanggan.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nama: true,
      username: true,
      status: true,
      tokenVersion: true,
      tenantId: true,
    },
  });

  if (!customer) return null;

  const customerTokenVersion = customer.tokenVersion ?? 0;
  const tokenVersion = (payload.tokenVersion as number) ?? 0;
  if (customer.status !== "AKTIF" || customerTokenVersion > tokenVersion) {
    return null;
  }

  return {
    ...payload,
    sub: customer.id,
    userId: customer.id,
    role: "CUSTOMER",
    permissions: ["customer:read", "customer:write"],
    isSales: false,
    siteId: null,
    tenantId: customer.tenantId,
  } as MobileTokenPayload;
}

async function verifyMitraToken(
  userId: string,
  payload: MobileTokenPayload,
): Promise<MobileTokenPayload | null> {
  const mitra = await prismaMitraAuth.mitra.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      isActive: true,
      mitraType: true,
      siteId: true,
      tenantId: true,
      tokenVersion: true,
    },
  });

  if (!mitra || !mitra.isActive) return null;

  const mitraTokenVersion = mitra.tokenVersion ?? 0;
  const tokenVersion = (payload.tokenVersion as number) ?? 0;
  if (mitraTokenVersion > tokenVersion) {
    return null;
  }

  return {
    ...payload,
    sub: mitra.id,
    userId: mitra.id,
    role: "MITRA",
    permissions: getMitraMobileCapabilities(mitra.mitraType).permissions,
    isSales: mitra.mitraType === "MITRA_SALES",
    siteId: mitra.siteId,
    tenantId: mitra.tenantId,
  } as MobileTokenPayload;
}

async function verifyValidatedMobileToken(
  token: string,
  expectedType: "access" | "refresh",
  versionCodeOverride?: number | null,
  preloadedDetails?: MobileTokenDetails | null,
): Promise<MobileTokenPayload | null> {
  try {
    const details =
      preloadedDetails ??
      (await getMobileTokenDetails(token, versionCodeOverride));
    if (!details) {
      return null;
    }

    const { payload, versionAccess, versionCode } = details;
    const userId = (payload.sub || payload.id) as string;
    const tokenType = payload.type === "refresh" ? "refresh" : "access";

    if (tokenType !== expectedType) {
      return null;
    }

    if (!versionAccess.isSupported) {
      logger.info(
        `[MOBILE_AUTH] App version unsupported for user ${userId}. Version code: ${versionCode}, minimum: ${versionAccess.minimumVersionCode}`,
      );
      return null;
    }

    // Route query berdasarkan claim `role` agar 1 query per request, bukan
    // 2-3 fallback chain (user → pelanggan → mitra). Untuk token legacy
    // tanpa claim role, fallback ke chain lama.
    const claimedRole = typeof payload.role === "string" ? payload.role : null;

    if (claimedRole === "CUSTOMER") {
      return verifyCustomerToken(userId, payload);
    }
    if (claimedRole === "MITRA") {
      return verifyMitraToken(userId, payload);
    }

    const dbUser = await prismaAuth.user.findUnique({
      where: { id: userId },
      select: {
        tokenVersion: true,
        isActive: true,
        isSales: true,
        siteId: true,
        tenantId: true,
        userSites: {
          select: { siteId: true },
        },
        role: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!dbUser) {
      // Legacy fallback: token lama tanpa claim role.
      const customerPayload = await verifyCustomerToken(userId, payload);
      if (customerPayload) return customerPayload;
      return verifyMitraToken(userId, payload);
    }

    const userTokenVersion = dbUser.tokenVersion ?? 0;
    const tokenVersion = (payload.tokenVersion as number) ?? 0;
    if (!dbUser.isActive || userTokenVersion > tokenVersion) {
      return null;
    }

    const roleName = dbUser.role?.name || "USER";
    const isSuperAdmin =
      dbUser.role?.isSuperAdmin || isSuperAdminRole(roleName);
    const permissions = isSuperAdmin
      ? ["*"]
      : dbUser.role?.permission.map(
          (permission: { resource: string; action: string }) =>
            `${permission.resource}:${permission.action}`,
        ) || [];

    const siteIds = dbUser.userSites.map((s) => s.siteId);

    return {
      ...payload,
      sub: userId,
      userId,
      role: roleName,
      permissions,
      isSales: dbUser.isSales,
      siteId: dbUser.siteId,
      siteIds,
      tenantId: dbUser.tenantId,
      isSuperAdmin,
      accessAdminPanel: Boolean(dbUser.role?.accessAdminPanel),
    } as MobileTokenPayload;
  } catch (error) {
    logger.error("[MOBILE_AUTH] Token verification failed:", error);
    return null;
  }
}

export async function verifyMobileToken(
  token: string,
  versionCodeOverride?: number | null,
  preloadedDetails?: MobileTokenDetails | null,
): Promise<MobileTokenPayload | null> {
  return verifyValidatedMobileToken(
    token,
    "access",
    versionCodeOverride,
    preloadedDetails,
  );
}

export async function verifyMobileRefreshToken(
  token: string,
  versionCodeOverride?: number | null,
  preloadedDetails?: MobileTokenDetails | null,
): Promise<MobileTokenPayload | null> {
  return verifyValidatedMobileToken(
    token,
    "refresh",
    versionCodeOverride,
    preloadedDetails,
  );
}
