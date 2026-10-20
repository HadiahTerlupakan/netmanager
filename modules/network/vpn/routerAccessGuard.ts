import type { NextResponse } from "next/server";
import { ApiErrors } from "@/lib/api-response";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  MikroTikRouterService,
  RouterAccessDeniedError,
  RouterNotFoundError,
} from "../services/MikroTikRouterService";

type SessionUser = Parameters<typeof isSuperAdmin>[0] & {
  id: string;
  tenantId?: string;
};

/**
 * Pemeriksaan awal route VPN sebuah router: izin `permission`, router ada di
 * tenant pengguna, dan (dengan izin `mikrotik:site_only`) berada di site-nya.
 * Mengembalikan respons penolakan atau null.
 */
export async function routerVpnAccessGuard(
  routerId: string,
  user: SessionUser,
  permission: "mikrotik:read" | "mikrotik:update",
): Promise<NextResponse | null> {
  if (!(await hasPermission(permission))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && !isSuperAdmin(user);
  try {
    await new MikroTikRouterService().getRouterById({
      id: routerId,
      tenantId: user.tenantId,
      userId: user.id,
      restrictedToOwnSite,
    });
    return null;
  } catch (error) {
    if (error instanceof RouterNotFoundError) {
      return ApiErrors.notFound("Router");
    }
    if (error instanceof RouterAccessDeniedError) {
      return ApiErrors.forbidden("Akses ditolak");
    }
    throw error;
  }
}
