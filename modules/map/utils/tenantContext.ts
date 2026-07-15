import { TenantContextError } from "@/lib/prisma-extension";

export interface TenantContext {
  tenantId: string | null | undefined;
  isSuperAdmin: boolean;
}

export interface MapListFilters {
  siteId?: string;
}

export function buildTenantWhere(
  ctx: TenantContext,
): { tenantId?: string } | undefined {
  if (ctx.isSuperAdmin) {
    return undefined;
  }
  if (!ctx.tenantId) {
    throw new TenantContextError(
      "missing-context",
      "Non-superadmin request without tenantId",
    );
  }
  return { tenantId: ctx.tenantId };
}

export function buildMapWhere(
  ctx: TenantContext,
  filters?: MapListFilters,
): { tenantId?: string; siteId?: string } | undefined {
  const tenantWhere = buildTenantWhere(ctx);
  if (!filters?.siteId) {
    return tenantWhere;
  }
  return {
    ...(tenantWhere ?? {}),
    siteId: filters.siteId,
  };
}

interface SessionUser {
  tenantId?: string | null;
  isSuperAdmin?: boolean | null;
}

export function buildTenantContext(
  user: SessionUser | null | undefined,
): TenantContext {
  const isSuper = !!user?.isSuperAdmin;
  return { tenantId: user?.tenantId, isSuperAdmin: isSuper };
}
