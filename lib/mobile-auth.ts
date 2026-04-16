import { SignJWT, jwtVerify } from "jose";
import {
  getAppVersionService,
  type VersionAccessResult,
} from "@/modules/app-version/services/AppVersionService";
import { prismaAuth } from "@/lib/prisma";
import { prismaMitraAuth } from "@/lib/prisma-mitra";

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

async function getMobileTokenVersion(payload: Record<string, unknown>) {
  let tokenVersion = 0;
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
    tokenVersion = user?.tokenVersion ?? 0;
  } catch (error) {
    console.error("[MOBILE_AUTH] Error fetching tokenVersion:", error);
  }

  return tokenVersion;
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

export function getMitraMobileCapabilities(mitraType?: string | null): {
  features: string[];
  permissions: string[];
} {
  const baseFeatures = ["m_dashboard", "m_mitra_wallet", "m_mitra_withdraw"];
  const basePermissions = ["m_dashboard:read"];

  if (mitraType === "MITRA_SALES") {
    return {
      features: [...baseFeatures, "m_canvasing"],
      permissions: [
        ...basePermissions,
        "m_canvasing:read",
        "m_canvasing:create",
      ],
    };
  }

  if (mitraType === "MITRA_TEKNISI") {
    return {
      features: [
        ...baseFeatures,
        "m_work_order",
        "m_barang",
        "m_barang_masuk",
        "m_barang_keluar",
      ],
      permissions: [
        ...basePermissions,
        "m_work_order:read",
        "m_barang:read",
        "m_barang_masuk:read",
        "m_barang_masuk:create",
        "m_barang_keluar:read",
        "m_barang_keluar:create",
      ],
    };
  }

  return {
    features: baseFeatures,
    permissions: basePermissions,
  };
}

export function hasMobilePermission(
  permissions: string[] | undefined,
  requiredPermission: string,
): boolean {
  return (
    (permissions ?? []).includes("*") ||
    (permissions ?? []).includes(requiredPermission)
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

function resolveVersionCode(payload: MobileTokenPayload): number {
  const tokenVersionCode = Number(
    payload.appVersionCode ?? payload.versionCode ?? 0,
  );
  return Number.isFinite(tokenVersionCode) && tokenVersionCode > 0
    ? tokenVersionCode
    : 0;
}

export async function getMobileTokenDetails(
  token: string,
  _versionCodeOverride?: number | null,
): Promise<MobileTokenDetails | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const mobilePayload = payload as MobileTokenPayload;
    const versionCode = resolveVersionCode(mobilePayload);
    const versionAccess =
      await getAppVersionService().evaluateVersionAccess(versionCode);

    return {
      payload: mobilePayload,
      versionCode,
      versionAccess,
    };
  } catch (error) {
    console.error("[MOBILE_AUTH] Token parsing failed:", error);
    return null;
  }
}

async function verifyValidatedMobileToken(
  token: string,
  expectedType: "access" | "refresh",
  _versionCodeOverride?: number | null,
): Promise<MobileTokenPayload | null> {
  try {
    console.log("[MOBILE_AUTH] Verifying token...");
    const details = await getMobileTokenDetails(token);
    if (!details) {
      console.log("[MOBILE_AUTH] Token details could not be parsed");
      return null;
    }

    const { payload, versionAccess, versionCode } = details;
    const userId = (payload.sub || payload.id) as string;
    const tokenType = payload.type === "refresh" ? "refresh" : "access";

    if (tokenType !== expectedType) {
      console.log(
        `[MOBILE_AUTH] Invalid token type for ${userId}. Expected ${expectedType}, received ${tokenType}`,
      );
      return null;
    }

    console.log("[MOBILE_AUTH] Token payload verified for user:", userId);

    if (!versionAccess.isSupported) {
      console.log(
        `[MOBILE_AUTH] App version unsupported for user ${userId}. Version code: ${versionCode}, minimum: ${versionAccess.minimumVersion}`,
      );
      return null;
    }

    const dbUser = await prismaAuth.user.findUnique({
      where: { id: userId as string },
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
      console.log(
        "[MOBILE_AUTH] User not found in User table, checking Pelanggan...",
        userId,
      );

      const customer = await prismaAuth.pelanggan.findUnique({
        where: { id: userId as string },
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
        console.log("[MOBILE_AUTH] Customer found:", customer.nama);

        if (customer.status !== "AKTIF") {
          console.log("[MOBILE_AUTH] Customer is inactive:", userId);
          return null;
        }

        const tokenVersion = (payload.tokenVersion as number) ?? 0;
        if (customer.tokenVersion > tokenVersion) {
          console.log(
            `[MOBILE_AUTH] Customer token version mismatch for ${userId}. DB: ${customer.tokenVersion}, Token: ${tokenVersion}`,
          );
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
        } as unknown as MobileTokenPayload;
      }

      console.log(
        "[MOBILE_AUTH] Customer not found, checking Mitra...",
        userId,
      );
      const mitra = await prismaMitraAuth.mitra.findUnique({
        where: { id: userId as string },
        select: {
          id: true,
          name: true,
          isActive: true,
          mitraType: true,
          siteId: true,
          tenantId: true,
        },
      });

      if (mitra) {
        console.log("[MOBILE_AUTH] Mitra found:", mitra.name);

        if (!mitra.isActive) {
          console.log("[MOBILE_AUTH] Mitra is inactive:", userId);
          return null;
        }

        const capabilities = getMitraMobileCapabilities(mitra.mitraType);

        return {
          ...payload,
          sub: mitra.id,
          userId: mitra.id,
          role: "MITRA",
          permissions: capabilities.permissions,
          isSales: mitra.mitraType === "MITRA_SALES",
          siteId: mitra.siteId,
          tenantId: mitra.tenantId,
        } as unknown as MobileTokenPayload;
      }

      console.log("[MOBILE_AUTH] User/Customer/Mitra not found in DB:", userId);
      return null;
    }

    if (!dbUser.isActive) {
      console.log("[MOBILE_AUTH] User is inactive:", userId);
      return null;
    }

    const tokenVersion = (payload.tokenVersion as number) ?? 0;
    if (dbUser.tokenVersion > tokenVersion) {
      console.log(
        `[MOBILE_AUTH] Token revoked for user ${userId}. DB version: ${dbUser.tokenVersion}, Token version: ${tokenVersion}`,
      );
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
          (p: { resource: string; action: string }) =>
            `${p.resource}:${p.action}`,
        ) || [];
    console.log(`[MOBILE_AUTH] Permissions for ${userId}:`, permissions.length);

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
    } as unknown as MobileTokenPayload;
  } catch (error) {
    console.error("[MOBILE_AUTH] Token verification failed:", error);
    return null;
  }
}

export async function verifyMobileToken(
  token: string,
  _versionCodeOverride?: number | null,
): Promise<MobileTokenPayload | null> {
  return verifyValidatedMobileToken(token, "access");
}

export async function verifyMobileRefreshToken(
  token: string,
  _versionCodeOverride?: number | null,
): Promise<MobileTokenPayload | null> {
  return verifyValidatedMobileToken(token, "refresh");
}
