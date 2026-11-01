import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";
import { PEMBATASAN_SITE_GUDANG } from "../utils/validation";
import {
  isPrismaError,
  pesanGagalHapus,
  pesanGagalSimpan,
  pesanTidakDitemukan,
  translateMasterDataError,
  type MasterDataErrorTranslation,
  type MasterDataFailure,
} from "./inventory-master-data-errors";

const GUDANG_RESTRICTED_PERMISSIONS = [...PEMBATASAN_SITE_GUDANG];
const GUDANG_CODE_PREFIX = "GD";
const GUDANG_CODE_RANDOM_RANGE = 1000;

interface InventoryGudangRecord {
  id: string;
  kode: string;
  nama: string;
  lokasi?: string | null;
  isActive?: boolean;
  /** Ikut dimuat oleh `findGudangById`; dipakai untuk menjelaskan isi gudang. */
  barangGudang?: Array<{ stok: number }>;
}

interface InventoryGudangRepositoryPort {
  getAllGudang(params?: {
    siteId?: string;
    includeInactive?: boolean;
  }): Promise<unknown[]>;
  createGudang(data: {
    kode: string;
    nama: string;
    isActive: boolean;
    lokasi?: string;
    siteIds?: string[];
  }): Promise<unknown>;
  findGudangById(id: string): Promise<InventoryGudangRecord | null>;
  findGudangByKode(kode: string): Promise<{ id: string; nama?: string } | null>;
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
  /** Sertakan gudang nonaktif; hanya layar manajemen gudang yang memintanya. */
  includeInactive?: boolean;
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
  | MasterDataFailure;

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/** Pesan untuk kolom wajib gudang yang masih kosong. */
const PESAN_KOLOM_GUDANG_KOSONG = {
  kode: "Kode gudang belum diisi. Tulis kode gudangnya.",
  nama: "Nama gudang belum diisi. Tulis nama gudangnya, contoh: Gudang Utama.",
} as const;

const GUDANG_TIDAK_DITEMUKAN: MasterDataErrorTranslation = {
  matches: isPrismaError("P2025"),
  status: HTTP_NOT_FOUND,
  message: pesanTidakDitemukan("Gudang"),
};

/** Error yang mungkin muncul saat membuat gudang. */
const CREATE_GUDANG_ERRORS: readonly MasterDataErrorTranslation[] = [
  {
    matches: isPrismaError("P2002"),
    status: HTTP_CONFLICT,
    message:
      "Kode gudang otomatis kebetulan sama dengan gudang lain. Coba simpan sekali lagi.",
  },
  {
    // Terjadi bila site yang dipilih sudah dihapus saat gudang disambungkan.
    matches: isPrismaError("P2025"),
    status: HTTP_BAD_REQUEST,
    message:
      "Site yang dipilih untuk gudang ini tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu pilih site lagi.",
  },
];

/** Error yang mungkin muncul saat mengubah gudang. */
const UPDATE_GUDANG_ERRORS: readonly MasterDataErrorTranslation[] = [
  {
    matches: isPrismaError("P2002"),
    status: HTTP_CONFLICT,
    message: "Kode gudang itu sudah dipakai gudang lain. Pakai kode lain.",
  },
  GUDANG_TIDAK_DITEMUKAN,
];

/** Error yang mungkin muncul saat menghapus gudang yang bernama `nama`. */
function deleteGudangErrors(
  nama: string,
): readonly MasterDataErrorTranslation[] {
  return [
    {
      matches: isPrismaError("P2003"),
      status: HTTP_CONFLICT,
      message: `Gudang "${nama}" tidak bisa dihapus karena sudah punya catatan, misalnya barang masuk, barang keluar, atau pindah barang. Catatan itu harus tetap ada. Kalau gudang ini tidak dipakai lagi, nonaktifkan saja lewat tombol Edit.`,
    },
    GUDANG_TIDAK_DITEMUKAN,
  ];
}

/** Jelaskan kenapa gudang yang masih berisi barang tidak boleh dihapus. */
function describeGudangMasihBerisi(gudang: InventoryGudangRecord): string {
  const terisi = (gudang.barangGudang ?? []).filter((stock) => stock.stok > 0);
  const totalStok = terisi.reduce((sum, stock) => sum + stock.stok, 0);
  const isi =
    terisi.length > 0
      ? ` masih ada ${terisi.length} jenis barang di dalamnya (total stok ${totalStok})`
      : " masih ada stok barang di dalamnya";
  return `Gudang "${gudang.nama}" tidak bisa dihapus karena${isi}. Keluarkan atau pindahkan semua barangnya ke gudang lain dulu, baru hapus gudangnya.`;
}

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

    return this.repository.getAllGudang({
      ...(shouldRestrict ? { siteId } : {}),
      ...(input.includeInactive ? { includeInactive: true } : {}),
    });
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
    const invalidBody = findKolomGudangKosong(input.body, ["nama"]);
    if (invalidBody) return invalidBody;

    const restrictedSiteId = await this.resolveGudangSiteId(input);
    const siteIds = this.resolveCreateSiteIds(
      input.body.siteIds,
      restrictedSiteId,
    );
    try {
      const gudang = await this.repository.createGudang({
        kode: this.createCode(),
        nama: String(input.body.nama),
        isActive: (input.body.isActive as boolean | undefined) ?? true,
        ...(input.body.lokasi ? { lokasi: String(input.body.lokasi) } : {}),
        ...(siteIds ? { siteIds } : {}),
      });

      return { success: true, data: gudang };
    } catch (error: unknown) {
      return translateMasterDataError(error, CREATE_GUDANG_ERRORS, {
        message: pesanGagalSimpan("Gudang"),
        logContext: "Gudang gagal dibuat",
      });
    }
  }

  /** Perbarui gudang dengan validasi body, keberadaan, dan konflik kode. */
  async updateGudang(
    input: UpdateGudangRouteInput,
  ): Promise<InventoryGudangRouteResult<unknown>> {
    const invalidBody = findKolomGudangKosong(input.body, ["kode", "nama"]);
    if (invalidBody) return invalidBody;

    const existingGudang = await this.repository.findGudangById(input.id);
    if (!existingGudang) {
      return {
        success: false,
        status: HTTP_NOT_FOUND,
        error: pesanTidakDitemukan("Gudang"),
      };
    }

    const kode = String(input.body.kode).trim();
    const kodeConflict = await this.repository.findGudangByKode(kode);
    if (kodeConflict && kodeConflict.id !== input.id) {
      const pemakai = kodeConflict.nama ? ` "${kodeConflict.nama}"` : " lain";
      return {
        success: false,
        status: HTTP_CONFLICT,
        error: `Kode gudang "${kode}" sudah dipakai gudang${pemakai}. Pakai kode lain.`,
      };
    }

    try {
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
    } catch (error: unknown) {
      return translateMasterDataError(error, UPDATE_GUDANG_ERRORS, {
        message: pesanGagalSimpan("Perubahan gudang"),
        logContext: "Gudang gagal diubah",
      });
    }
  }

  /** Hapus gudang setelah validasi keberadaan dan stok. */
  async deleteGudang(id: string): Promise<InventoryGudangRouteResult<null>> {
    const existingGudang = await this.repository.findGudangById(id);
    if (!existingGudang) {
      return {
        success: false,
        status: HTTP_NOT_FOUND,
        error: pesanTidakDitemukan("Gudang"),
      };
    }

    if (await this.repository.hasStockInGudang(id)) {
      return {
        success: false,
        status: HTTP_CONFLICT,
        error: describeGudangMasihBerisi(existingGudang),
      };
    }

    try {
      await this.repository.deleteGudang(id);
      return { success: true, data: null };
    } catch (error: unknown) {
      return translateMasterDataError(
        error,
        deleteGudangErrors(existingGudang.nama),
        {
          message: pesanGagalHapus("Gudang"),
          logContext: "Gudang gagal dihapus",
        },
      );
    }
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

/** Laporkan semua kolom wajib gudang yang kosong sekaligus, satu baris per kolom. */
function findKolomGudangKosong(
  body: Record<string, unknown>,
  kolomWajib: ReadonlyArray<keyof typeof PESAN_KOLOM_GUDANG_KOSONG>,
): MasterDataFailure | null {
  const kosong = kolomWajib.filter(
    (kolom) => !String(body[kolom] ?? "").trim(),
  );
  if (kosong.length === 0) return null;

  return {
    success: false,
    status: HTTP_BAD_REQUEST,
    error: kosong.map((kolom) => PESAN_KOLOM_GUDANG_KOSONG[kolom]).join("\n"),
    details: Object.fromEntries(
      kosong.map((kolom) => [kolom, [PESAN_KOLOM_GUDANG_KOSONG[kolom]]]),
    ),
  };
}

function createGudangCode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * GUDANG_CODE_RANDOM_RANGE);
  return `${GUDANG_CODE_PREFIX}${timestamp.toString().slice(-6)}${random.toString().padStart(3, "0")}`;
}

export const inventoryGudangRouteService = new InventoryGudangRouteService();
