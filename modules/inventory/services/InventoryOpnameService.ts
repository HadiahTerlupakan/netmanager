import { isSuperAdmin } from "@/lib/auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";

import { createInventoryOpname } from "./inventory-opname-create.helpers";
import {
  buildEmptyOpnameListResponse,
  buildListOpnameWhere,
  findPagedOpnameRecords,
} from "./inventory-opname-list.helpers";

type InventoryUserContext = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  permissions?: string[];
  siteId?: string | null;
  tenantId?: string | null;
};

export type ListInventoryOpnameInput = {
  user: InventoryUserContext;
  barangId?: string;
  gudangId?: string;
  page: number;
  limit: number;
};

export type CreateInventoryOpnameInput = {
  user: InventoryUserContext;
  barangId: string;
  gudangId: string;
  stokFisik: number;
  keterangan?: string;
  kondisiBaik?: number;
  kondisiRusak?: number;
  kondisiExpire?: number;
  lokasiPenyimpanan?: string;
  nomorRak?: string;
  nomorBox?: string;
  suhuPenyimpanan?: string;
  kelembaban?: string;
  tanggalExpire?: string;
  nomorBatch?: string;
  catatanDetail?: string;
  alasanSelisih?: string;
};

async function ensureTenantContextForNonSuperAdmin(user: InventoryUserContext) {
  const tenantContext = await getTenantIdFromContext();
  const isSuper = isSuperAdmin(user as never) || tenantContext.isSuperAdmin;

  if (!isSuper && !tenantContext.tenantId && !user.tenantId) {
    throw new Error(
      "SECURITY_BREACH: tenant context is required for non-superadmin inventory opname access",
    );
  }
}

export class InventoryOpnameService {
  async listOpname(input: ListInventoryOpnameInput) {
    await ensureTenantContextForNonSuperAdmin(input.user);
    const where = await buildListOpnameWhere(input);
    if (!where) return buildEmptyOpnameListResponse(input);
    return findPagedOpnameRecords({
      where,
      page: input.page,
      limit: input.limit,
    });
  }

  /** Buat stock opname dan sinkronkan selisih stok. */
  async createOpname(input: CreateInventoryOpnameInput) {
    await ensureTenantContextForNonSuperAdmin(input.user);
    return createInventoryOpname(input);
  }
}

let inventoryOpnameServiceInstance: InventoryOpnameService | null = null;

export function getInventoryOpnameService(): InventoryOpnameService {
  if (!inventoryOpnameServiceInstance) {
    inventoryOpnameServiceInstance = new InventoryOpnameService();
  }

  return inventoryOpnameServiceInstance;
}
