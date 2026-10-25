import { prisma } from "@/modules/database";
import type { IsolirPage } from "@prisma/client";
import type { IsolirPageInput } from "./isolir-page.types";

export const IsolirPageRepository = {
  /** Filter tenantId selalu eksplisit agar benar di konteks request maupun sistem. */
  findByTenant(tenantId: string | null): Promise<IsolirPage | null> {
    return prisma.isolirPage.findFirst({ where: { tenantId } });
  },

  upsertForTenant(
    tenantId: string,
    data: Partial<IsolirPageInput>,
  ): Promise<IsolirPage> {
    return prisma.isolirPage.upsert({
      where: { tenantId },
      create: { ...data, tenantId },
      update: data,
    });
  },

  /**
   * Dipanggil layanan isolir tanpa sesi, jadi pemanggil wajib berada di
   * konteks sistem agar filter tenant tidak menyembunyikan router.
   */
  findTenantIdByVpnAddress(
    address: string,
  ): Promise<{ tenantId: string | null } | null> {
    return prisma.mikroTikRouter.findFirst({
      where: { vpnAddress: address },
      select: { tenantId: true },
    });
  },

  /** Router tujuan halaman isolir tenant; kredensial sengaja tidak dibaca. */
  findRouterSyncStatus(tenantId: string) {
    return prisma.mikroTikRouter.findMany({
      where: { tenantId, isolirMode: "ROUTER_PAGE" },
      select: {
        id: true,
        name: true,
        isolirPageHash: true,
        isolirPageSyncedAt: true,
        isolirPageError: true,
      },
      orderBy: { name: "asc" },
    });
  },
};
