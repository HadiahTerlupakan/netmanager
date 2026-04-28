import { InventoryRepository } from "../repositories/InventoryRepository";
import type { UpdateBarangInput } from "../repositories/IInventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";
import { getInventoryBarangService } from "./InventoryBarangService";

const SITE_RESTRICTION_PERMISSIONS = [
  "barang:site_only",
  "k_barang:site_only",
  "gudang:site_only",
];

interface InventoryBarangRouteRepository {
  findBarangDetail(id: string): Promise<InventoryBarangRecord | null>;
  findBarangById(id: string): Promise<InventoryBarangRecord | null>;
  findBarangByKode(kode: string): Promise<{ id: string } | null>;
  updateBarang(id: string, data: UpdateBarangInput): Promise<unknown>;
  deleteBarang(id: string): Promise<void>;
}

interface InventoryBarangRecord {
  id: string;
  barangGudang?: InventoryBarangStockRecord[];
  [key: string]: unknown;
}

interface InventoryBarangStockRecord {
  stok: number;
  gudang?: {
    sites?: Array<{ id: string }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface InventoryBarangListResult {
  barangs: Array<{ id: string; [key: string]: unknown }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface InventoryBarangCreateResult {
  barang: { id: string; kode: string };
}

interface InventoryBarangServicePort {
  listBarang(input: {
    userId: string;
    search?: string | null;
    gudangId?: string | null;
    page: number;
    limit: number;
    siteId?: string;
  }): Promise<InventoryBarangListResult>;
  createBarang(input: {
    userId: string;
    kode?: string;
    nama: string;
    satuan: string;
    isWorkOrderMaterial?: boolean;
    jenis?: string;
    kategoriAset?: string;
    minStokDefault?: number;
  }): Promise<InventoryBarangCreateResult>;
}

interface InventoryRouteServicePort {
  getUserSiteId(userId: string): Promise<string | undefined>;
}

interface ListBarangRouteInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  search?: string | null;
  gudangId?: string | null;
  page: number;
  limit: number;
}

interface CreateBarangRouteInput {
  userId: string;
  body: Record<string, unknown>;
}

interface UpdateBarangRouteInput {
  id: string;
  siteId?: string;
  body: Record<string, unknown>;
}

export type InventoryBarangRouteResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; status: number; error: string };

export class InventoryBarangRouteService {
  constructor(
    private readonly repository: InventoryBarangRouteRepository = new InventoryRepository(),
    private readonly barangService: InventoryBarangServicePort = getInventoryBarangService(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
  ) {}

  /** Ambil list barang dengan site restriction yang sudah diselesaikan. */
  async listBarang(input: ListBarangRouteInput) {
    const siteId = await this.resolveRestrictedSiteId(input);
    return this.barangService.listBarang({
      userId: input.userId,
      search: input.search,
      gudangId: input.gudangId,
      page: input.page,
      limit: input.limit,
      siteId,
    });
  }

  /** Buat barang baru setelah payload route tervalidasi. */
  async createBarang(
    input: CreateBarangRouteInput,
  ): Promise<InventoryBarangRouteResult<InventoryBarangCreateResult>> {
    const invalidBody = this.validateCreateBody(input.body);
    if (invalidBody) return invalidBody;

    const barang = await this.barangService.createBarang({
      userId: input.userId,
      kode: input.body.kode as string | undefined,
      nama: String(input.body.nama),
      satuan: String(input.body.satuan),
      isWorkOrderMaterial: input.body.isWorkOrderMaterial as
        | boolean
        | undefined,
      jenis: input.body.jenis as string | undefined,
      kategoriAset: input.body.kategoriAset as string | undefined,
      minStokDefault: input.body.minStokDefault as number | undefined,
    });

    return {
      success: true,
      data: barang,
      message: "Barang berhasil dibuat",
    };
  }

  /** Ambil detail barang beserta stok yang sudah dibatasi site. */
  async getBarangDetail(input: { id: string; siteId?: string }) {
    const barang = await this.repository.findBarangDetail(input.id);
    if (!barang) {
      return { found: false as const };
    }

    return {
      found: true as const,
      barang: this.withStockSummary(barang, input.siteId),
    };
  }

  /** Perbarui barang dengan validasi akses site dan konflik kode. */
  async updateBarang(
    input: UpdateBarangRouteInput,
  ): Promise<InventoryBarangRouteResult<unknown>> {
    const invalidBody = this.validateUpdateBody(input.body);
    if (invalidBody) return invalidBody;

    const existingBarang = await this.repository.findBarangById(input.id);
    if (!existingBarang) {
      return { success: false, status: 404, error: "Barang tidak ditemukan" };
    }

    if (!this.canAccessBarang(existingBarang, input.siteId)) {
      return {
        success: false,
        status: 403,
        error: "Anda tidak memiliki akses ke barang ini di site Anda",
      };
    }

    const kode = String(input.body.kode);
    const kodeConflict = await this.repository.findBarangByKode(kode);
    if (kodeConflict && kodeConflict.id !== input.id) {
      return {
        success: false,
        status: 400,
        error: "Kode barang sudah digunakan",
      };
    }

    const updatedBarang = await this.repository.updateBarang(
      input.id,
      this.toUpdateData(input.body),
    );
    return {
      success: true,
      data: updatedBarang,
      message: "Barang berhasil diperbarui",
    };
  }

  /** Hapus barang dengan validasi akses site. */
  async deleteBarang(input: {
    id: string;
    siteId?: string;
  }): Promise<InventoryBarangRouteResult<null>> {
    const barang = await this.repository.findBarangById(input.id);
    if (!barang) {
      return {
        success: false as const,
        status: 404,
        error: "Barang tidak ditemukan",
      };
    }

    if (!this.canAccessBarang(barang, input.siteId)) {
      return {
        success: false as const,
        status: 403,
        error: "Anda tidak memiliki akses untuk menghapus barang ini",
      };
    }

    await this.repository.deleteBarang(input.id);
    return {
      success: true as const,
      data: null,
      message: "Barang berhasil dihapus",
    };
  }

  private async resolveRestrictedSiteId(input: ListBarangRouteInput) {
    if (input.isSuperAdmin) return undefined;
    if (!this.hasSiteRestriction(input.permissions)) return undefined;

    return this.inventoryRouteService.getUserSiteId(input.userId);
  }

  private hasSiteRestriction(permissions: string[]) {
    return permissions.some((permission) =>
      SITE_RESTRICTION_PERMISSIONS.includes(permission),
    );
  }

  private validateCreateBody(body: Record<string, unknown>) {
    if (!body.nama || !body.satuan) {
      return {
        success: false as const,
        status: 400,
        error: "Nama dan satuan barang harus diisi",
      };
    }

    return null;
  }

  private validateUpdateBody(body: Record<string, unknown>) {
    if (!body.kode || !body.nama || !body.satuan) {
      return {
        success: false as const,
        status: 400,
        error: "Kode, nama, dan satuan barang harus diisi",
      };
    }

    return null;
  }

  private toUpdateData(body: Record<string, unknown>): UpdateBarangInput {
    return {
      kode: String(body.kode),
      nama: String(body.nama),
      satuan: String(body.satuan),
      isWorkOrderMaterial: Boolean(body.isWorkOrderMaterial),
      jenis: body.jenis as UpdateBarangInput["jenis"],
      kategoriAset: body.kategoriAset as UpdateBarangInput["kategoriAset"],
      minStokDefault: body.minStokDefault as number | undefined,
    };
  }

  private withStockSummary(barang: InventoryBarangRecord, siteId?: string) {
    const barangGudang = this.filterBarangGudang(
      barang.barangGudang || [],
      siteId,
    );
    return {
      ...barang,
      barangGudang,
      totalStock: barangGudang.reduce((sum, stock) => sum + stock.stok, 0),
    };
  }

  private filterBarangGudang(
    barangGudang: InventoryBarangStockRecord[],
    siteId?: string,
  ) {
    if (!siteId) return barangGudang;
    return barangGudang.filter((stock) =>
      this.stockBelongsToSite(stock, siteId),
    );
  }

  private canAccessBarang(barang: InventoryBarangRecord, siteId?: string) {
    if (!siteId) return true;
    return (barang.barangGudang || []).some((stock) =>
      this.stockBelongsToSite(stock, siteId),
    );
  }

  private stockBelongsToSite(
    stock: InventoryBarangStockRecord,
    siteId: string,
  ) {
    return stock.gudang?.sites?.some((site) => site.id === siteId) ?? false;
  }
}

export const inventoryBarangRouteService = new InventoryBarangRouteService();
