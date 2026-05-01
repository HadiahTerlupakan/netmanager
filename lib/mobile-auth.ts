import { logger } from "@/lib/logger";
import { SignJWT, jwtVerify } from "jose";
import {
  getAppVersionService,
  type VersionAccessResult,
} from "@/modules/app-version";
import { prismaAuth } from "@/lib/prisma";
import { prismaMitraAuth } from "@/lib/prisma-mitra";

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
      return 0;
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

export async function signMobileToken(payload: Record<string, unknown>) {
  const tokenVersion = await getMobileTokenVersion(payload);
  const jwtPayload = buildMobileJwtPayload(payload, tokenVersion);

  return await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function signMobileRefreshToken(payload: Record<string, unknown>) {
  const tokenVersion = await getMobileTokenVersion(payload);
  const jwtPayload = buildMobileJwtPayload(payload, tokenVersion, "refresh");

  return await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
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
  tenantId?: string | null;
  isSuperAdmin?: boolean;
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
  const permissions = ["m_dashboard:read"];

  if (mitraType === "MITRA_SALES") {
    permissions.push("m_canvasing:read", "m_canvasing:create");
  }

  if (mitraType === "MITRA_TEKNISI") {
    permissions.push(
      "m_work_order:read",
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
  if (
    typeof versionCodeOverride === "number" &&
    Number.isFinite(versionCodeOverride) &&
    versionCodeOverride > 0
  ) {
    return versionCodeOverride;
  }

  const tokenVersionCode = Number(
    payload.appVersionCode ?? payload.versionCode ?? 0,
  );
  return Number.isFinite(tokenVersionCode) && tokenVersionCode > 0
    ? tokenVersionCode
    : 0;
}

export async function getMobileTokenDetails(
  token: string,
  versionCodeOverride?: number | null,
): Promise<MobileTokenDetails | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const mobilePayload = payload as MobileTokenPayload;
    const versionCode = resolveVersionCode(mobilePayload, versionCodeOverride);
    const versionAccess = await (
      await getAppVersionService()
    ).evaluateVersionAccess(versionCode);

    return {
      payload: mobilePayload,
      versionCode,
      versionAccess,
    };
  } catch (error) {
    logger.error("[MOBILE_AUTH] Token parsing failed:", error);
    return null;
  }
}

async function verifyValidatedMobileToken(
  token: string,
  expectedType: "access" | "refresh",
  versionCodeOverride?: number | null,
): Promise<MobileTokenPayload | null> {
  try {
    const details = await getMobileTokenDetails(token, versionCodeOverride);
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
        `[MOBILE_AUTH] App version unsupported for user ${userId}. Version code: ${versionCode}, minimum: ${versionAccess.minimumVersion}`,
      );
      return null;
    }

    const dbUser = await prismaAuth.user.findUnique({
      where: { id: userId },
      select: {
        tokenVersion: true,
        isActive: true,
        isSales: true,
        siteId: true,
        tenantId: true,
        role: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!dbUser) {
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

      if (customer) {
        const customerTokenVersion = customer.tokenVersion ?? 0;
        const tokenVersion = (payload.tokenVersion as number) ?? 0;
        if (
          customer.status !== "AKTIF" ||
          customerTokenVersion > tokenVersion
        ) {
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

      const mitra = await prismaMitraAuth.mitra.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          isActive: true,
          mitraType: true,
          siteId: true,
          tenantId: true,
        },
      });

      if (!mitra || !mitra.isActive) {
        return null;
      }

      return {
        ...payload,
        sub: mitra.id,
        userId: mitra.id,
        role: "MITRA",
        permissions: getMitraMobileFeatures(mitra.mitraType),
        isSales: mitra.mitraType === "MITRA_SALES",
        siteId: mitra.siteId,
        tenantId: mitra.tenantId,
      } as MobileTokenPayload;
    }

    const userTokenVersion = dbUser.tokenVersion ?? 0;
    const tokenVersion = (payload.tokenVersion as number) ?? 0;
    if (!dbUser.isActive || userTokenVersion > tokenVersion) {
      return null;
    }

    const roleName = dbUser.role?.name || "USER";
    const isSuperAdmin =
      dbUser.role?.isSuperAdmin ||
      roleName === "SUPER_ADMIN" ||
      roleName === "Super Admin";
    const permissions = isSuperAdmin
      ? ["*"]
      : dbUser.role?.permission.map(
          (permission: { resource: string; action: string }) =>
            `${permission.resource}:${permission.action}`,
        ) || [];

    return {
      ...payload,
      sub: userId,
      userId,
      role: roleName,
      permissions,
      isSales: dbUser.isSales,
      siteId: dbUser.siteId,
      tenantId: dbUser.tenantId,
      isSuperAdmin,
    } as MobileTokenPayload;
  } catch (error) {
    logger.error("[MOBILE_AUTH] Token verification failed:", error);
    return null;
  }
}

export async function verifyMobileToken(
  token: string,
  versionCodeOverride?: number | null,
): Promise<MobileTokenPayload | null> {
  return verifyValidatedMobileToken(token, "access", versionCodeOverride);
}

export async function verifyMobileRefreshToken(
  token: string,
  versionCodeOverride?: number | null,
): Promise<MobileTokenPayload | null> {
  return verifyValidatedMobileToken(token, "refresh", versionCodeOverride);
}
