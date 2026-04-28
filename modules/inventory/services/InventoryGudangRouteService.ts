import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";

const GUDANG_RESTRICTED_PERMISSIONS = [
  "gudang:site_only",
  "k_barang:site_only",
];
const GUDANG_CODE_PREFIX = "GD";
const GUDANG_CODE_RANDOM_RANGE = 1000;

interface InventoryGudangRecord {
  id: string;
  kode: string;
  nama: string;
  lokasi?: string | null;
  isActive?: boolean;
}

interface InventoryGudangRepositoryPort {
  getAllGudang(params?: { siteId?: string }): Promise<unknown[]>;
  createGudang(data: {
    kode: string;
    nama: string;
    isActive: boolean;
    lokasi?: string;
    siteIds?: string[];
  }): Promise<unknown>;
  findGudangById(id: string): Promise<InventoryGudangRecord | null>;
  findGudangByKode(kode: string): Promise<{ id: string } | null>;
  updateGudang(
    id: string,
    data: { kode: string; nama: string; lokasi?: string; isActive?: boolean },
  ): Promise<unknown>;
  hasStockInGudang(id: string): Promise<boolean>;
  deleteGudang(id: string): Promise<void>;
}

interface InventoryRouteServicePort {
  resolveRestrictedSiteId(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
    restrictedPermissions: string[];
  }): Promise<string | undefined>;
}

interface GudangRouteUserInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface ListGudangRouteInput extends GudangRouteUserInput {
  viewAll: boolean;
}

interface CreateGudangRouteInput extends GudangRouteUserInput {
  body: Record<string, unknown>;
}

interface UpdateGudangRouteInput {
  id: string;
  body: Record<string, unknown>;
}

export type InventoryGudangRouteResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string };

export class InventoryGudangRouteService {
  constructor(
    private readonly repository: InventoryGudangRepositoryPort = new InventoryRepository(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
    private readonly createCode: () => string = createGudangCode,
  ) {}

  /** Ambil daftar gudang dengan site restriction route. */
  async listGudang(input: ListGudangRouteInput) {
    const siteId = await this.resolveGudangSiteId(input);
    const shouldRestrict = !!siteId && !(input.viewAll && input.isSuperAdmin);

    return this.repository.getAllGudang(
      shouldRestrict ? { siteId } : undefined,
    );
  }

  /** Ambil detail gudang berdasarkan id. */
  async getGudangDetail(id: string) {
    const gudang = await this.repository.findGudangById(id);
    if (!gudang) return { found: false as const };

    return { found: true as const, gudang };
  }

  /** Buat gudang setelah validasi body dan site restriction. */
  async createGudang(
    input: CreateGudangRouteInput,
  ): Promise<InventoryGudangRouteResult<unknown>> {
    if (!input.body.nama) {
      return {
        success: false,
        status: 400,
        error: "Nama gudang harus diisi",
      };
    }

    const restrictedSiteId = await this.resolveGudangSiteId(input);
    const siteIds = this.resolveCreateSiteIds(
      input.body.siteIds,
      restrictedSiteId,
    );
    const gudang = await this.repository.createGudang({
      kode: this.createCode(),
      nama: String(input.body.nama),
      isActive: (input.body.isActive as boolean | undefined) ?? true,
      ...(input.body.lokasi ? { lokasi: String(input.body.lokasi) } : {}),
      ...(siteIds ? { siteIds } : {}),
    });

    return { success: true, data: gudang };
  }

  /** Perbarui gudang dengan validasi body, keberadaan, dan konflik kode. */
  async updateGudang(
    input: UpdateGudangRouteInput,
  ): Promise<InventoryGudangRouteResult<unknown>> {
    const invalidBody = this.validateUpdateBody(input.body);
    if (invalidBody) return invalidBody;

    const existingGudang = await this.repository.findGudangById(input.id);
    if (!existingGudang) {
      return { success: false, status: 404, error: "Gudang tidak ditemukan" };
    }

    const kode = String(input.body.kode);
    const kodeConflict = await this.repository.findGudangByKode(kode);
    if (kodeConflict && kodeConflict.id !== input.id) {
      return {
        success: false,
        status: 400,
        error: "Kode gudang sudah digunakan",
      };
    }

    const gudang = await this.repository.updateGudang(input.id, {
      kode,
      nama: String(input.body.nama),
      ...(input.body.lokasi ? { lokasi: String(input.body.lokasi) } : {}),
      isActive:
        input.body.isActive !== undefined
          ? Boolean(input.body.isActive)
          : existingGudang.isActive,
    });

    return { success: true, data: gudang };
  }

  /** Hapus gudang setelah validasi keberadaan dan stok. */
  async deleteGudang(id: string): Promise<InventoryGudangRouteResult<null>> {
    const existingGudang = await this.repository.findGudangById(id);
    if (!existingGudang) {
      return { success: false, status: 404, error: "Gudang tidak ditemukan" };
    }

    if (await this.repository.hasStockInGudang(id)) {
      return {
        success: false,
        status: 400,
        error: "Tidak dapat menghapus gudang yang masih memiliki stok barang",
      };
    }

    await this.repository.deleteGudang(id);
    return { success: true, data: null };
  }

  private validateUpdateBody(body: Record<string, unknown>) {
    if (!body.kode || !body.nama) {
      return {
        success: false as const,
        status: 400,
        error: "Kode dan nama gudang harus diisi",
      };
    }

    return null;
  }

  private resolveGudangSiteId(input: GudangRouteUserInput) {
    return this.inventoryRouteService.resolveRestrictedSiteId({
      userId: input.userId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      restrictedPermissions: GUDANG_RESTRICTED_PERMISSIONS,
    });
  }

  private resolveCreateSiteIds(siteIds: unknown, restrictedSiteId?: string) {
    if (restrictedSiteId) return [restrictedSiteId];
    if (Array.isArray(siteIds)) return siteIds.filter(this.isString);
    return undefined;
  }

  private isString(value: unknown): value is string {
    return typeof value === "string";
  }
}

function createGudangCode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * GUDANG_CODE_RANDOM_RANGE);
  return `${GUDANG_CODE_PREFIX}${timestamp.toString().slice(-6)}${random.toString().padStart(3, "0")}`;
}

export const inventoryGudangRouteService = new InventoryGudangRouteService();
