import { isSuperAdmin } from "@/lib/auth/super-admin";
import { hasCapability } from "@/lib/permission-aliases";
import type { UserContext } from "./WorkOrderService";
import {
  getWorkOrderScopeViolation,
  type ObserverWorkOrderAccessGuard,
} from "./work-order-access";

/** Kapabilitas panel web yang membuat non-peserta boleh melihat work order. */
export const WORK_ORDER_READ_CAPABILITY = "workorders:read";

/**
 * Pemuat profil lingkup (site via `userSites`, departemen) pembaca dari
 * database; token mobile tidak membawa departemen.
 */
export type ObserverScopeContextLoader = (
  user: { id: string; role?: string; name?: string | null },
  permissions: string[],
) => Promise<UserContext | null>;

/**
 * Guard pengamat jalur baca detail mobile: lolos bila permission role ASLI
 * pembaca memuat `workorders:read` (alias & `*` ikut dihitung) dan WO berada
 * dalam lingkup `workorders:site_only|department_only`-nya — aturan yang sama
 * dengan panel web. Super admin melewati lingkup. Tenant sudah diperiksa
 * pemanggil sebelum guard ini dijalankan.
 */
export function createMobileObserverWorkOrderGuard(input: {
  permissions: readonly string[];
  loadScopeContext: ObserverScopeContextLoader;
}): ObserverWorkOrderAccessGuard {
  const permissions = [...input.permissions];

  return async (workOrder, userContext) => {
    if (!hasCapability(permissions, WORK_ORDER_READ_CAPABILITY)) return false;
    if (isSuperAdmin(userContext)) return true;

    const scopeContext = await input.loadScopeContext(
      { id: userContext.id, role: userContext.role, name: userContext.name },
      permissions,
    );
    if (!scopeContext) return false;

    return getWorkOrderScopeViolation(workOrder, scopeContext) === null;
  };
}
