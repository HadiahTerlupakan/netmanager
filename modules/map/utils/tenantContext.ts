import { TenantContextError } from "@/lib/prisma-extension";

export interface TenantContext {
  tenantId: string | null | undefined;
  isSuperAdmin: boolean;
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
