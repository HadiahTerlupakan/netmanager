import { logger } from "@/lib/logger";
import { runAsSystemContext } from "@/lib/tenant-context";
import {
  NetworkRepository,
  type IsolirPushRouterRecord,
} from "../repositories/NetworkRepository";
import { runProvisioningConnection } from "../services/mikrotik-provisioning.connection";
import { writeIsolirPageFile } from "../services/mikrotik-provisioning.isolir-page";
import { getRouterCredentials } from "../services/router-credentials";
import { resolveIsolirContent } from "./isolir-content";
import { recordIsolirPageSync } from "./isolir-provisioning";
import { renderIsolirPage } from "./isolir-render";

/** Ringkasan satu kali pengiriman halaman isolir ke router tenant. */
export type IsolirPushSummary = {
  total: number;
  sent: number;
  skipped: number;
  failed: Array<{ routerId: string; error: string }>;
};

type IsolirPushDeps = {
  repository: Pick<
    NetworkRepository,
    "findIsolirPageRouters" | "updateIsolirPageSync"
  >;
};

async function writePageToRouter(
  router: IsolirPushRouterRecord,
  html: string,
): Promise<void> {
  const { username, password } = getRouterCredentials(router);
  const logs: string[] = [];
  await runProvisioningConnection({
    routerDetails: {
      ip: router.ipAddress,
      port: router.apiPort,
      username,
      password,
    },
    operation: (connection) => writeIsolirPageFile(connection, html, logs),
  });
}

/**
 * Tulis halaman isolir terbaru ke semua router ROUTER_PAGE milik tenant.
 * Berjalan setelah respons HTTP, di luar konteks tenant request, sehingga
 * memakai konteks sistem. Router dikirimi satu per satu, satu koneksi per
 * router, supaya satu router yang lambat atau offline tidak membebani yang
 * lain; router yang gagal menyusul pada Reconfigurasi berikutnya.
 */
export function pushIsolirPageToTenantRouters(
  tenantId: string,
  deps: IsolirPushDeps = { repository: new NetworkRepository() },
): Promise<IsolirPushSummary> {
  return runAsSystemContext(`isolir-push:${tenantId}`, async () => {
    const { repository } = deps;
    const routers = await repository.findIsolirPageRouters(tenantId);
    const summary: IsolirPushSummary = {
      total: routers.length,
      sent: 0,
      skipped: 0,
      failed: [],
    };
    if (routers.length === 0) {
      return summary;
    }

    // Isi halaman per tenant, jadi cukup dirender sekali untuk semua router.
    const { html, hash } = renderIsolirPage(
      await resolveIsolirContent(tenantId),
    );
    for (const router of routers) {
      if (router.isolirPageHash === hash) {
        summary.skipped += 1;
        continue;
      }
      try {
        await writePageToRouter(router, html);
        summary.sent += 1;
        await recordIsolirPageSync(repository, router.id, {
          hash,
          syncedAt: new Date(),
          error: null,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        summary.failed.push({ routerId: router.id, error: message });
        logger.warn(
          `[Isolir] Halaman isolir gagal dikirim ke router ${router.name}: ${message}`,
        );
        await recordIsolirPageSync(repository, router.id, {
          hash: null,
          error: message,
        });
      }
    }
    logger.info(
      `[Isolir] Pengiriman halaman tenant ${tenantId}: ${summary.sent} terkirim, ${summary.skipped} sudah sama, ${summary.failed.length} gagal`,
    );
    return summary;
  });
}
