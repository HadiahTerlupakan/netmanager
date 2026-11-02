import {
  validateInventoryMutationCreateBody,
  validateInventoryMutationJumlah,
} from "./inventory-route-validation.helpers";
import { toInventoryMutationFailure } from "./inventory-mutation-errors";
import { MUTASI_STOK_PESAN } from "../domain/inventory-user-error";
import type { KondisiBarang } from "../types/asset.enums";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";
import type { LingkupSite } from "@/modules/roles/client";

import { IZIN_PEMBATAS_KELUAR } from "../domain/izin-pembatas-site";
import type {
  CanAccessGudangInput,
  ResolveLingkupSiteInput,
} from "./InventoryRouteService";
import { gudangDalamLingkup, siteIdsSaringan } from "./lingkup-gudang";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";

const DEFAULT_KONDISI_BARANG = "BARU" as KondisiBarang;

interface InventoryKeluarRepositoryPort {
  getHistoryKeluar(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    search?: string;
    siteIds?: string[];
  }): Promise<{ items: unknown[]; total: number }>;
  getStockBreakdown(
    barangId: string,
    gudangId: string,
  ): Promise<{ baru: number; bekas: number; rusak: number; total: number }>;
  removeStock(data: {
    barangId: string;
    gudangId: string;
    jumlah: number;
    kondisi: KondisiBarang;
    tujuanPenggunaan?: string;
    keterangan?: string;
    isHilang: boolean;
    fotoBukti: string[];
    fotoMetadata: Record<string, unknown> | null;
    tanggal: Date;
    userId?: string;
    tenantId?: string;
  }): Promise<unknown>;
  getStockLevel(barangId: string, gudangId: string): Promise<number>;
}

interface InventoryRouteServicePort {
  resolveLingkupSite(input: ResolveLingkupSiteInput): Promise<LingkupSite>;
  canAccessGudang(input: CanAccessGudangInput): Promise<boolean>;
  getKeluarRecordWithSite(id: string): Promise<KeluarRecordWithSite | null>;
  updateKeluarRecord(input: {
    id: string;
    jumlah: number;
    keterangan?: string;
  }): Promise<KeluarMutationResult>;
  deleteKeluarRecord(id: string): Promise<KeluarMutationResult>;
}

type KeluarRecordWithSite = {
  gudang: { sites?: Array<{ id: string }> };
};

type KeluarMutationResult = {
  barangNama: string;
  jumlahLama?: number;
  jumlah?: number;
};

interface ListKeluarRouteInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  page: number;
  limit: number;
  barangId?: string;
  gudangId?: string;
  search?: string;
  siteId?: string;
}

interface CreateKeluarRouteInput {
  userId: string;
  tenantId?: string;
  body: Record<string, unknown>;
}

interface KeluarDetailAccessInput {
  id: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface StockBreakdownRouteInput {
  barangId: string;
  gudangId: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

type StockBreakdownByKondisi = {
  stokByKondisi: { BARU: number; BEKAS: number; RUSAK: number; total: number };
};

interface KeluarUpdateInput extends KeluarDetailAccessInput {
  body: Record<string, unknown>;
}

export type InventoryKeluarRouteResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string };

type KeluarAccessResult =
  | { success: true; record: KeluarRecordWithSite }
  | { success: false; status: number; error: string };

export class InventoryKeluarRouteService {
  constructor(
    private readonly repository: InventoryKeluarRepositoryPort = new InventoryRepository(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
  ) {}

  /** Ambil histori barang keluar dengan filter dan site restriction. */
  async listKeluar(input: ListKeluarRouteInput) {
    const lingkup = await this.resolveKeluarLingkup(input);
    const siteIds = siteIdsSaringan(lingkup, input.siteId);
    const { items: keluarList, total } = await this.repository.getHistoryKeluar(
      {
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        ...(input.barangId ? { barangId: input.barangId } : {}),
        ...(input.gudangId ? { gudangId: input.gudangId } : {}),
        ...(input.search ? { search: input.search } : {}),
        ...(siteIds ? { siteIds } : {}),
      },
    );

    return {
      keluarList,
      pagination: buildPaginationMeta({
        page: input.page,
        limit: input.limit,
        total,
      }),
    };
  }

  /**
   * Ambil stok per kondisi untuk barang di gudang. Gudang datang dari klien,
   * jadi lingkup site-nya diperiksa dulu dengan pembatas yang sama dengan
   * daftar barang keluar.
   */
  async getStockBreakdown(
    input: StockBreakdownRouteInput,
  ): Promise<InventoryKeluarRouteResult<StockBreakdownByKondisi>> {
    const bolehAkses = await this.inventoryRouteService.canAccessGudang({
      userId: input.userId,
      gudangId: input.gudangId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      restrictedPermissions: IZIN_PEMBATAS_KELUAR,
    });
    if (!bolehAkses) {
      return {
        success: false as const,
        status: 403,
        error: MUTASI_STOK_PESAN.gudangBedaSite,
      };
    }

    const stock = await this.repository.getStockBreakdown(
      input.barangId,
      input.gudangId,
    );
    return {
      success: true as const,
      data: {
        stokByKondisi: {
          BARU: stock.baru,
          BEKAS: stock.bekas,
          RUSAK: stock.rusak,
          total: stock.total,
        },
      },
    };
  }

  /** Ambil detail barang keluar setelah validasi akses site. */
  async getKeluarDetail(
    input: KeluarDetailAccessInput,
  ): Promise<InventoryKeluarRouteResult<{ keluar: KeluarRecordWithSite }>> {
    const accessCheck = await this.validateKeluarAccess(input);
    if (accessCheck.success === false) return accessCheck;

    return { success: true as const, data: { keluar: accessCheck.record } };
  }

  /** Ubah barang keluar setelah validasi akses dan payload. */
  async updateKeluar(
    input: KeluarUpdateInput,
  ): Promise<
    InventoryKeluarRouteResult<{ result: KeluarMutationResult; jumlah: number }>
  > {
    const accessCheck = await this.validateKeluarAccess(input);
    if (accessCheck.success === false) return accessCheck;

    const invalidJumlah = validateInventoryMutationJumlah(input.body.jumlah);
    if (invalidJumlah) return invalidJumlah;

    const jumlah = Number(input.body.jumlah);
    let result: KeluarMutationResult;
    try {
      result = await this.inventoryRouteService.updateKeluarRecord({
        id: input.id,
        jumlah,
        keterangan: input.body.keterangan as string | undefined,
      });
    } catch (error) {
      return toInventoryMutationFailure(error, "Perubahan barang keluar");
    }
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.UPDATE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.BARANG_KELUAR,
      reference: result.barangNama,
      actorId: input.userId,
      details: {
        barangKeluarId: input.id,
        jumlahLama: result.jumlahLama,
        jumlahBaru: jumlah,
        keterangan: input.body.keterangan,
      },
    });
    return { success: true as const, data: { result, jumlah } };
  }

  /** Hapus barang keluar setelah validasi akses site. */
  async deleteKeluar(
    input: KeluarDetailAccessInput,
  ): Promise<InventoryKeluarRouteResult<KeluarMutationResult>> {
    const accessCheck = await this.validateKeluarAccess(input);
    if (accessCheck.success === false) return accessCheck;

    let result: KeluarMutationResult;
    try {
      result = await this.inventoryRouteService.deleteKeluarRecord(input.id);
    } catch (error) {
      return toInventoryMutationFailure(error, "Penghapusan barang keluar");
    }
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.DELETE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.BARANG_KELUAR,
      reference: result.barangNama,
      actorId: input.userId,
      details: { barangKeluarId: input.id, jumlah: result.jumlah },
    });
    return { success: true as const, data: result };
  }

  /** Catat barang keluar setelah validasi payload. */
  async createKeluar(input: CreateKeluarRouteInput): Promise<
    InventoryKeluarRouteResult<{
      keluarRecord: unknown;
      finalStock: number;
      parsedJumlah: number;
    }>
  > {
    const invalidBody = this.validateCreateBody(input.body);
    if (invalidBody) return invalidBody;

    const parsedJumlah = Number(input.body.jumlah);
    const barangId = String(input.body.barangId);
    const gudangId = String(input.body.gudangId);
    let keluarRecord: unknown;
    try {
      keluarRecord = await this.repository.removeStock({
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        kondisi:
          (input.body.kondisi as KondisiBarang | undefined) ||
          DEFAULT_KONDISI_BARANG,
        tujuanPenggunaan: input.body.tujuanPenggunaan as string | undefined,
        keterangan: input.body.keterangan as string | undefined,
        isHilang: Boolean(input.body.isHilang),
        fotoBukti: (input.body.fotoBukti as string[] | undefined) || [],
        fotoMetadata:
          (input.body.fotoMetadata as Record<string, unknown> | undefined) ||
          null,
        tanggal: new Date(),
        userId: input.userId,
        tenantId: input.tenantId,
      });
    } catch (error) {
      return toInventoryMutationFailure(error, "Barang keluar");
    }
    const finalStock = await this.repository.getStockLevel(barangId, gudangId);

    return {
      success: true,
      data: { keluarRecord, finalStock, parsedJumlah },
    };
  }

  private resolveKeluarLingkup(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
  }) {
    return this.inventoryRouteService.resolveLingkupSite({
      userId: input.userId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      restrictedPermissions: IZIN_PEMBATAS_KELUAR,
    });
  }

  private async validateKeluarAccess(
    input: KeluarDetailAccessInput,
  ): Promise<KeluarAccessResult> {
    const record = await this.inventoryRouteService.getKeluarRecordWithSite(
      input.id,
    );
    if (!record) {
      return {
        success: false as const,
        status: 404,
        error: MUTASI_STOK_PESAN.keluarTidakDitemukan,
      };
    }

    const lingkup = await this.resolveKeluarLingkup(input);
    const gudangSiteIds = record.gudang.sites?.map((site) => site.id) ?? [];
    if (!gudangDalamLingkup(lingkup, gudangSiteIds)) {
      return {
        success: false as const,
        status: 403,
        error: MUTASI_STOK_PESAN.catatanBedaSite,
      };
    }

    return { success: true as const, record };
  }

  private validateCreateBody(body: Record<string, unknown>) {
    return validateInventoryMutationCreateBody(body);
  }
}

export const inventoryKeluarRouteService = new InventoryKeluarRouteService();
