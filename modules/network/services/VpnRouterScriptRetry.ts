import { logger } from "@/lib/logger";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import type { IMikroTikRouterVpnRepository } from "../domain/ports/IMikroTikRouterVpnRepository";
import { createVpnRouterService } from "../factories/VpnRouterServiceFactory";
import { MikroTikRouterVpnRepository } from "../repositories/MikroTikRouterVpnRepository";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { isVpnConfigured, VpnCoreError } from "../vpn/VpnCoreClient";
import type { VpnRouterService } from "./VpnRouterService";

/** Jumlah maksimum router per tenant yang skripnya dikirim ulang dalam satu siklus. */
export const VPN_SCRIPT_RETRY_BATCH_SIZE = 20;

type RetryDeps = {
  tenants: { findActiveTenants(): Promise<{ id: string }[]> };
  repo: Pick<IMikroTikRouterVpnRepository, "findStaleOnline">;
  service: Pick<VpnRouterService, "retryStaleScript">;
};

function defaultDeps(): RetryDeps {
  return {
    tenants: new NetworkRepository(),
    repo: new MikroTikRouterVpnRepository(),
    service: createVpnRouterService(),
  };
}

// True bila core bermasalah: sisa router dan tenant menunggu siklus berikutnya.
async function retryTenantScripts(
  tenantId: string,
  deps: RetryDeps,
): Promise<boolean> {
  const routers = await deps.repo.findStaleOnline(
    tenantId,
    VPN_SCRIPT_RETRY_BATCH_SIZE,
  );
  for (const router of routers) {
    try {
      await deps.service.retryStaleScript(router, tenantId);
    } catch (error) {
      if (error instanceof VpnCoreError) {
        logger.warn(
          "[VPN] Core gagal saat mengirim ulang skrip switch:",
          error,
        );
        return true;
      }
      logger.error(
        `[VPN] Kirim ulang skrip switch router ${router.id} gagal:`,
        error,
      );
    }
  }
  return false;
}

/**
 * Kirim ulang skrip switch untuk router VPN online yang daftar servernya belum
 * sampai, per tenant. Berhenti pada galat core pertama.
 */
export async function retryStaleVpnScripts(
  deps: RetryDeps = defaultDeps(),
): Promise<void> {
  if (!isVpnConfigured()) return;
  const tenants = await runAsSystemContext(
    "retryStaleVpnScripts: discover active tenants",
    () => deps.tenants.findActiveTenants(),
  );
  for (const tenant of tenants) {
    const isCoreDown = await runWithRequestTenantContext(
      { tenantId: tenant.id, isSuperAdmin: false },
      () => retryTenantScripts(tenant.id, deps),
    );
    if (isCoreDown) return;
  }
}
