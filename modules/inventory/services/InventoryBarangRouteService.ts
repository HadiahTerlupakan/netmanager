import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";
import { getInventoryBarangService } from "./InventoryBarangService";
import {
  BarangKodeDipakaiError,
  BarangKodeOtomatisGagalError,
} from "./inventory-barang.service-helpers";
import {
  isPrismaError,
  pesanGagalHapus,
  pesanGagalSimpan,
  pesanTidakDitemukan,
  translateMasterDataError,
  type MasterDataErrorTranslation,
  type MasterDataFailure,
} from "./inventory-master-data-errors";
import {
  canAccessBarang,
  toUpdateBarangData,
  validateBarangCreateBody,
  validateBarangUpdateBody,
  withStockSummary,
} from "./inventory-barang-route.helpers";

import type { UpdateBarangInput } from "../domain/ports/IInventoryOperationRepository";

const SITE_RESTRICTION_PERMISSIONS = ["barang:site_only", "gudang:site_only"];

interface InventoryBarangRouteRepository {
  findBarangDetail(id: string): Promise<Record<string, unknown> | null>;
  findBarangById(id: string): Promise<Record<string, unknown> | null>;
  findBarangByKode(kode: string): Promise<{ id: string; nama?: string } | null>;
  updateBarang(id: string, data: UpdateBarangInput): Promise<unknown>;
  deleteBarang(id: string): Promise<void>;
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
  | MasterDataFailure;

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;

const PESAN_KODE_BARANG_BENTROK =
  "Kode barang itu sudah dipakai barang lain. Pakai kode lain, atau kosongkan kolom kode supaya dibuat otomatis.";

/** Error yang mungkin muncul saat membuat barang. */
const CREATE_BARANG_ERRORS: readonly MasterDataErrorTranslation[] = [
  {
    matches: (error) => error instanceof BarangKodeDipakaiError,
    status: HTTP_CONFLICT,
    message: (error) => error.message,
  },
  {
    matches: (error) => error instanceof BarangKodeOtomatisGagalError,
    status: HTTP_SERVER_ERROR,
    message: (error) => error.message,
  },
  {
    matches: isPrismaError("P2002"),
    status: HTTP_CONFLICT,
    message: PESAN_KODE_BARANG_BENTROK,
  },
];

/** Error yang mungkin muncul saat mengubah barang. */
const UPDATE_BARANG_ERRORS: readonly MasterDataErrorTranslation[] = [
  {
    matches: (error) =>
      error.message.startsWith("Satuan barang tidak boleh diubah"),
    status: HTTP_BAD_REQUEST,
    message:
      "Satuan barang tidak bisa diganti karena barang ini masih punya stok. Keluarkan atau pindahkan stoknya dulu sampai habis, baru ganti satuannya.",
  },
  {
    matches: (error) =>
      error.message === "Barang tidak ditemukan" ||
      isPrismaError("P2025")(error),
    status: HTTP_NOT_FOUND,
    message: pesanTidakDitemukan("Barang"),
  },
  {
    matches: isPrismaError("P2002"),
    status: HTTP_CONFLICT,
    message: PESAN_KODE_BARANG_BENTROK,
  },
];

/** Error yang mungkin muncul saat menghapus barang yang bernama `nama`. */
function deleteBarangErrors(
  nama: string,
): readonly MasterDataErrorTranslation[] {
  return [
    {
      matches: isPrismaError("P2003"),
      status: HTTP_CONFLICT,
      message: `Barang "${nama}" tidak bisa dihapus karena sudah pernah dipakai, misalnya di barang masuk, barang keluar, work order, pesanan, atau aset. Catatan itu harus tetap ada, jadi barang ini dibiarkan saja.`,
    },
    {
      matches: isPrismaError("P2025"),
      status: HTTP_NOT_FOUND,
      message: pesanTidakDitemukan("Barang"),
    },
  ];
}

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
    const invalidBody = validateBarangCreateBody(input.body);
    if (invalidBody) return invalidBody;

    try {
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
    } catch (error: unknown) {
      return translateMasterDataError(error, CREATE_BARANG_ERRORS, {
        message: pesanGagalSimpan("Barang"),
        logContext: "Barang gagal dibuat",
      });
    }
  }

  /** Ambil detail barang beserta stok yang sudah dibatasi site. */
  async getBarangDetail(input: { id: string; siteId?: string }) {
    const barang = await this.repository.findBarangDetail(input.id);
    if (!barang) {
      return { found: false as const };
    }

    return {
      found: true as const,
      barang: withStockSummary(barang, input.siteId),
    };
  }

  /** Perbarui barang dengan validasi akses site dan konflik kode. */
  async updateBarang(
    input: UpdateBarangRouteInput,
  ): Promise<InventoryBarangRouteResult<unknown>> {
    const invalidBody = validateBarangUpdateBody(input.body);
    if (invalidBody) return invalidBody;

    const existingBarang = await this.repository.findBarangById(input.id);
    if (!existingBarang) {
      return {
        success: false,
        status: HTTP_NOT_FOUND,
        error: pesanTidakDitemukan("Barang"),
      };
    }

    if (!canAccessBarang(existingBarang, input.siteId)) {
      return {
        success: false,
        status: HTTP_FORBIDDEN,
        error:
          "Barang ini tidak ada di gudang site Anda, jadi Anda tidak bisa mengubahnya. Minta admin kalau barang ini memang harus Anda urus.",
      };
    }

    const kode = String(input.body.kode).trim();
    const kodeConflict = await this.repository.findBarangByKode(kode);
    if (kodeConflict && kodeConflict.id !== input.id) {
      const pemakai = kodeConflict.nama ? ` "${kodeConflict.nama}"` : " lain";
      return {
        success: false,
        status: HTTP_CONFLICT,
        error: `Kode barang "${kode}" sudah dipakai barang${pemakai}. Pakai kode lain.`,
      };
    }

    try {
      const updatedBarang = await this.repository.updateBarang(
        input.id,
        toUpdateBarangData(input.body),
      );
      return {
        success: true,
        data: updatedBarang,
        message: "Barang berhasil diperbarui",
      };
    } catch (error: unknown) {
      return translateMasterDataError(error, UPDATE_BARANG_ERRORS, {
        message: pesanGagalSimpan("Perubahan barang"),
        logContext: "Barang gagal diubah",
      });
    }
  }

  /** Hapus barang dengan validasi akses site. */
  async deleteBarang(input: {
    id: string;
    siteId?: string;
  }): Promise<InventoryBarangRouteResult<null>> {
    const barang = await this.repository.findBarangById(input.id);
    if (!barang) {
      return {
        success: false,
        status: HTTP_NOT_FOUND,
        error: pesanTidakDitemukan("Barang"),
      };
    }

    if (!canAccessBarang(barang, input.siteId)) {
      return {
        success: false,
        status: HTTP_FORBIDDEN,
        error:
          "Barang ini tidak ada di gudang site Anda, jadi Anda tidak bisa menghapusnya. Minta admin kalau barang ini memang harus dihapus.",
      };
    }

    try {
      await this.repository.deleteBarang(input.id);
      return {
        success: true,
        data: null,
        message: "Barang berhasil dihapus",
      };
    } catch (error: unknown) {
      return translateMasterDataError(
        error,
        deleteBarangErrors(String(barang.nama ?? "ini")),
        {
          message: pesanGagalHapus("Barang"),
          logContext: "Barang gagal dihapus",
        },
      );
    }
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
}

export const inventoryBarangRouteService = new InventoryBarangRouteService();
