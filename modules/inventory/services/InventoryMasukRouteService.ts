import type { KondisiBarang } from "@prisma/client";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { validateInventoryMutationCreateBody } from "./inventory-route-validation.helpers";
import { InventoryRepository } from "../repositories/InventoryRepository";
import type { InventoryMasukRecord } from "../repositories/IInventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";
import {
  getInventoryStockMovementService,
  type InventoryStockMovementService,
} from "./InventoryStockMovementService";

const MASUK_RESTRICTED_PERMISSIONS = [
  "masuk:site_only",
  "k_barang:site_only",
  "gudang:site_only",
];
const DEFAULT_KONDISI_BARANG = "BARU" as KondisiBarang;
const MASUK_NOT_FOUND_ERROR = "Record barang masuk tidak ditemukan";
const NEGATIVE_STOCK_ERROR = "Stok tidak bisa negatif";

interface InventoryMasukRepositoryPort {
  getHistoryMasuk(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    search?: string;
    siteId?: string;
  }): Promise<{ items: unknown[]; total: number }>;
  addStock(data: {
    barangId: string;
    gudangId: string;
    jumlah: number;
    kondisi: KondisiBarang;
    keterangan?: string;
    userId: string;
    fotoBukti: string[];
    fotoMetadata: Record<string, unknown> | null;
    tanggal: Date;
  }): Promise<unknown>;
  getStockLevel(barangId: string, gudangId: string): Promise<number>;
}

interface MasukDetailRouteInput {
  id: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface UpdateMasukRouteInput extends MasukDetailRouteInput {
  body: Record<string, unknown>;
}

interface InventoryRouteServicePort {
  resolveRestrictedSiteId(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
    restrictedPermissions: string[];
  }): Promise<string | undefined>;
}

interface ListMasukRouteInput {
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

interface CreateMasukRouteInput {
  userId: string;
  body: Record<string, unknown>;
}

interface MasukSiteScopeInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  siteId?: string;
}

interface UpdateMasukPayload {
  jumlah: number;
  kondisi?: string | null;
  keterangan?: string | null;
}

export type InventoryMasukRouteError = {
  success: false;
  status: number;
  error: string;
};

export type InventoryMasukRouteResult<T> =
  | { success: true; data: T }
  | InventoryMasukRouteError;

export class InventoryMasukRouteService {
  constructor(
    private readonly repository: InventoryMasukRepositoryPort = new InventoryRepository(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
    private readonly stockMovementService: InventoryStockMovementService = getInventoryStockMovementService(),
  ) {}

  /** Ambil histori barang masuk dengan filter dan site restriction. */
  async listMasuk(input: ListMasukRouteInput) {
    const siteId = await this.resolveMasukSiteId(input);
    const { items: masukList, total } = await this.repository.getHistoryMasuk({
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      ...(input.barangId ? { barangId: input.barangId } : {}),
      ...(input.gudangId ? { gudangId: input.gudangId } : {}),
      ...(input.search ? { search: input.search } : {}),
      ...(siteId ? { siteId } : {}),
    });

    return {
      masukList,
      pagination: buildPaginationMeta({
        page: input.page,
        limit: input.limit,
        total,
      }),
    };
  }

  /** Catat barang masuk setelah validasi payload. */
  async createMasuk(input: CreateMasukRouteInput): Promise<
    InventoryMasukRouteResult<{
      masukRecord: unknown;
      finalStock: number;
      parsedJumlah: number;
    }>
  > {
    const invalidBody = this.validateCreateBody(input.body);
    if (invalidBody) return invalidBody;

    const parsedJumlah = Number(input.body.jumlah);
    const barangId = String(input.body.barangId);
    const gudangId = String(input.body.gudangId);
    const masukRecord = await this.repository.addStock({
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      kondisi:
        (input.body.kondisi as KondisiBarang | undefined) ||
        DEFAULT_KONDISI_BARANG,
      keterangan: input.body.keterangan as string | undefined,
      userId: input.userId,
      fotoBukti: (input.body.fotoBukti as string[] | undefined) || [],
      fotoMetadata:
        (input.body.fotoMetadata as Record<string, unknown> | undefined) ||
        null,
      tanggal: new Date(),
    });
    const finalStock = await this.repository.getStockLevel(barangId, gudangId);

    return {
      success: true,
      data: { masukRecord, finalStock, parsedJumlah },
    };
  }

  /** Ambil detail barang masuk setelah akses site tervalidasi. */
  async getMasukDetail(
    input: MasukDetailRouteInput,
  ): Promise<InventoryMasukRouteResult<{ masuk: InventoryMasukRecord }>> {
    const masuk = await this.getAccessibleMasuk(input);
    if (masuk.success === false) return masuk;

    return { success: true, data: { masuk: masuk.data } };
  }

  /** Perbarui barang masuk setelah validasi payload dan akses site. */
  async updateMasuk(
    input: UpdateMasukRouteInput,
  ): Promise<InventoryMasukRouteResult<{ jumlah: number }>> {
    const masuk = await this.getAccessibleMasuk(input);
    if (masuk.success === false) return masuk;

    const payload = this.parseUpdateBody(input.body);
    if (payload.success === false) return payload;

    try {
      await this.stockMovementService.updateMasuk({
        id: input.id,
        jumlah: payload.data.jumlah,
        kondisi: payload.data.kondisi,
        keterangan: payload.data.keterangan,
      });
    } catch (error) {
      return this.mapMutationError(error, "Gagal memperbarui barang masuk");
    }

    return { success: true, data: { jumlah: payload.data.jumlah } };
  }

  /** Hapus barang masuk setelah akses site tervalidasi. */
  async deleteMasuk(
    input: MasukDetailRouteInput,
  ): Promise<InventoryMasukRouteResult<null>> {
    const masuk = await this.getAccessibleMasuk(input);
    if (masuk.success === false) return masuk;

    try {
      await this.stockMovementService.deleteMasuk(input.id);
    } catch (error) {
      return this.mapMutationError(
        error,
        "Gagal menghapus record barang masuk",
      );
    }

    return { success: true, data: null };
  }

  private async getAccessibleMasuk(
    input: MasukDetailRouteInput,
  ): Promise<InventoryMasukRouteResult<InventoryMasukRecord>> {
    const masuk = await this.stockMovementService.getMasukRecord(input.id);
    if (!masuk) return this.routeError(404, MASUK_NOT_FOUND_ERROR);

    const restrictedSiteId = await this.resolveMasukSiteId(input);
    if (!this.canAccessMasukSite(masuk, restrictedSiteId)) {
      return this.routeError(403, "Anda tidak memiliki akses ke data ini");
    }

    return { success: true, data: masuk };
  }

  private async resolveMasukSiteId(input: MasukSiteScopeInput) {
    return (
      (await this.inventoryRouteService.resolveRestrictedSiteId({
        userId: input.userId,
        permissions: input.permissions,
        isSuperAdmin: input.isSuperAdmin,
        restrictedPermissions: MASUK_RESTRICTED_PERMISSIONS,
      })) ?? input.siteId
    );
  }

  private canAccessMasukSite(
    masuk: InventoryMasukRecord,
    restrictedSiteId?: string,
  ) {
    if (!restrictedSiteId) return true;

    const gudangSiteIds = masuk.gudang.sites?.map((site) => site.id) || [];
    return gudangSiteIds.includes(restrictedSiteId);
  }

  private parseUpdateBody(
    body: Record<string, unknown>,
  ): InventoryMasukRouteResult<UpdateMasukPayload> {
    const jumlah = Number(body.jumlah);
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      return this.routeError(400, "Jumlah harus diisi dengan angka positif");
    }

    return {
      success: true,
      data: {
        jumlah,
        kondisi: body.kondisi as string | null | undefined,
        keterangan: body.keterangan as string | null | undefined,
      },
    };
  }

  private mapMutationError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    if (message === MASUK_NOT_FOUND_ERROR) {
      return this.routeError(404, MASUK_NOT_FOUND_ERROR);
    }
    if (message === NEGATIVE_STOCK_ERROR) {
      return this.routeError(400, NEGATIVE_STOCK_ERROR);
    }

    return this.routeError(500, fallback);
  }

  private routeError(status: number, error: string): InventoryMasukRouteError {
    return { success: false, status, error };
  }

  private validateCreateBody(body: Record<string, unknown>) {
    return validateInventoryMutationCreateBody(body);
  }
}

export const inventoryMasukRouteService = new InventoryMasukRouteService();
