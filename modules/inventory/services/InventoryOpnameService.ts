import { isSuperAdmin } from "@/lib/auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { prisma } from "@/modules/database";

import { InventoryRepository } from "../repositories/InventoryRepository";
import type {
  InventoryOpnameRecord,
  UpdateStockOpnameInput,
  UpdatedStockOpnameResult,
} from "../domain/ports/IInventoryOperationRepository";

import {
  createInventoryOpname,
  createOpnameInTransaction,
  type CreateOpnameTransactionResult,
} from "./inventory-opname-create.helpers";
import {
  buildEmptyOpnameListResponse,
  buildListOpnameStatsWhere,
  buildListOpnameWhere,
  computeOpnameHistoryStats,
  findPagedOpnameRecords,
  type OpnameHistoryStats,
} from "./inventory-opname-list.helpers";
import { namaPelaku } from "../domain/riwayat-stock-opname";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import type { PelakuPerubahanOpname } from "../domain/ports/IInventoryOperationRepository";

/**
 * SO bulanan mencatat seluruh barang gudang dalam satu transaksi; default
 * Prisma (5 detik) terlalu pendek untuk gudang dengan ratusan barang.
 */
const OPNAME_BATCH_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

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
  tanggalMulai?: string;
  tanggalSelesai?: string;
  alasanSelisih?: string;
  page: number;
  limit: number;
};

export type OpnameHistoryStatsInput = Omit<
  ListInventoryOpnameInput,
  "page" | "limit"
>;

export type UpdateInventoryOpnameInput = UpdateStockOpnameInput & {
  user: InventoryUserContext;
};

export type DeleteInventoryOpnameInput = {
  id: string;
  user: InventoryUserContext;
};

export type GetInventoryOpnameRecordInput = DeleteInventoryOpnameInput;

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

export type CreateInventoryOpnameBatchItem = Omit<
  CreateInventoryOpnameInput,
  "user" | "gudangId"
>;

export type CreateInventoryOpnameBatchInput = {
  user: InventoryUserContext;
  gudangId: string;
  items: CreateInventoryOpnameBatchItem[];
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

/**
 * Pelaku perubahan untuk jejak audit opname.
 *
 * Diambil dari sesi, bukan dari body permintaan: field `pic` pada catatan
 * opname adalah teks bebas yang ikut disunting operator, jadi ia tidak bisa
 * dipakai untuk menjawab siapa yang sebenarnya mengubah.
 */
function pelakuDari(user: InventoryUserContext): PelakuPerubahanOpname {
  return { id: user.id, nama: namaPelaku(user.name, user.email) };
}

export class InventoryOpnameService {
  constructor(
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
  ) {}

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

  /** Hitung agregat statistik untuk Riwayat Opname dengan filter yang sama. */
  async getHistoryStats(
    input: OpnameHistoryStatsInput,
  ): Promise<OpnameHistoryStats> {
    await ensureTenantContextForNonSuperAdmin(input.user);
    const where = await buildListOpnameStatsWhere(input);
    if (!where) return computeOpnameHistoryStats(null);
    return computeOpnameHistoryStats(where);
  }

  /** Ambil satu record opname (tenant-scoped). */
  async getOpnameRecord(
    input: GetInventoryOpnameRecordInput,
  ): Promise<InventoryOpnameRecord | null> {
    await ensureTenantContextForNonSuperAdmin(input.user);
    return this.inventoryRepository.getOpnameRecord(input.id);
  }

  /** Update opname dan sinkronkan stok. */
  async updateOpname(
    input: UpdateInventoryOpnameInput,
  ): Promise<UpdatedStockOpnameResult> {
    await ensureTenantContextForNonSuperAdmin(input.user);
    const { user, ...payload } = input;
    const opname = await this.inventoryRepository.getOpnameRecord(input.id);
    const result = await this.inventoryRepository.updateOpname(
      payload,
      pelakuDari(user),
    );
    if (opname) {
      recordOpnameActivity(INVENTORY_ACTIVITY_ACTIONS.UPDATE, opname, user, {
        stokFisik: input.stokFisik,
        stokSistem: result.stokSistem,
        selisih: result.selisih,
        keterangan: input.keterangan,
      });
    }
    return result;
  }

  /** Hapus opname dan kembalikan stok ke kondisi sebelum opname. */
  async deleteOpname(input: DeleteInventoryOpnameInput): Promise<void> {
    await ensureTenantContextForNonSuperAdmin(input.user);
    const opname = await this.inventoryRepository.getOpnameRecord(input.id);
    await this.inventoryRepository.deleteOpname(
      input.id,
      pelakuDari(input.user),
    );
    if (opname) {
      recordOpnameActivity(
        INVENTORY_ACTIVITY_ACTIONS.DELETE,
        opname,
        input.user,
      );
    }
  }

  /** Buat stock opname dan sinkronkan selisih stok. */
  async createOpname(input: CreateInventoryOpnameInput) {
    await ensureTenantContextForNonSuperAdmin(input.user);
    return createInventoryOpname(input);
  }

  /** Buat banyak stock opname dalam satu transaksi atomic. */
  async createOpnameBatch(
    input: CreateInventoryOpnameBatchInput,
  ): Promise<Array<CreateOpnameTransactionResult & { barangId: string }>> {
    await ensureTenantContextForNonSuperAdmin(input.user);

    return prisma.$transaction(async (tx) => {
      const results: Array<
        CreateOpnameTransactionResult & { barangId: string }
      > = [];

      for (const item of input.items) {
        const itemInput: CreateInventoryOpnameInput = {
          ...item,
          user: input.user,
          gudangId: input.gudangId,
        };
        const result = await createOpnameInTransaction(tx, itemInput);
        results.push({ ...result, barangId: item.barangId });
      }

      return results;
    }, OPNAME_BATCH_TRANSACTION_OPTIONS);
  }
}

let inventoryOpnameServiceInstance: InventoryOpnameService | null = null;

/** Catat ubah/hapus stock opname ke Log Aktivitas. */
function recordOpnameActivity(
  action:
    | typeof INVENTORY_ACTIVITY_ACTIONS.UPDATE
    | typeof INVENTORY_ACTIVITY_ACTIONS.DELETE,
  opname: InventoryOpnameRecord,
  user: InventoryUserContext,
  details: Record<string, unknown> = {},
) {
  recordInventoryActivity({
    action,
    subject: INVENTORY_ACTIVITY_SUBJECTS.STOCK_OPNAME,
    reference: opname.barang.nama,
    actorId: user.id,
    tenantId: user.tenantId,
    details: {
      opnameId: opname.id,
      barang: opname.barang.nama,
      gudang: opname.gudang.nama,
      ...details,
    },
  });
}

export function getInventoryOpnameService(): InventoryOpnameService {
  if (!inventoryOpnameServiceInstance) {
    inventoryOpnameServiceInstance = new InventoryOpnameService();
  }

  return inventoryOpnameServiceInstance;
}
