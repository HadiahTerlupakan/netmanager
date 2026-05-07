import { getInventoryOpnameService } from "./InventoryOpnameService";
import type {
  CreateInventoryOpnameInput,
  ListInventoryOpnameInput,
} from "./InventoryOpnameService";

type CreateInventoryOpnamePayload = Omit<CreateInventoryOpnameInput, "user">;
type CreateInventoryOpnameResult = {
  previousStock: number;
  newStock: number;
  selisih: number;
  opnameRecord: { id: string; [key: string]: unknown };
};

interface InventoryUserContext {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  permissions?: string[];
  siteId?: string | null;
}

interface InventoryOpnameBody {
  barangId?: unknown;
  gudangId?: unknown;
  stokFisik?: unknown;
  keterangan?: unknown;
  kondisiBaik?: unknown;
  kondisiRusak?: unknown;
  kondisiExpire?: unknown;
  lokasiPenyimpanan?: unknown;
  nomorRak?: unknown;
  nomorBox?: unknown;
  suhuPenyimpanan?: unknown;
  kelembaban?: unknown;
  tanggalExpire?: unknown;
  nomorBatch?: unknown;
  catatanDetail?: unknown;
  alasanSelisih?: unknown;
}

interface CreateOpnameRouteSuccess {
  success: true;
  data: CreateInventoryOpnameResult;
}

interface CreateOpnameRouteFailure {
  success: false;
  status: number;
  error: string;
}

export type CreateOpnameRouteResult =
  | CreateOpnameRouteSuccess
  | CreateOpnameRouteFailure;

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && value >= 0;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function toOptionalNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function buildCreateOpnamePayload(
  body: InventoryOpnameBody,
): CreateInventoryOpnamePayload {
  return {
    barangId: String(body.barangId),
    gudangId: String(body.gudangId),
    stokFisik: body.stokFisik as number,
    keterangan: toOptionalString(body.keterangan),
    kondisiBaik: toOptionalNumber(body.kondisiBaik),
    kondisiRusak: toOptionalNumber(body.kondisiRusak),
    kondisiExpire: toOptionalNumber(body.kondisiExpire),
    lokasiPenyimpanan: toOptionalString(body.lokasiPenyimpanan),
    nomorRak: toOptionalString(body.nomorRak),
    nomorBox: toOptionalString(body.nomorBox),
    suhuPenyimpanan: toOptionalString(body.suhuPenyimpanan),
    kelembaban: toOptionalString(body.kelembaban),
    tanggalExpire: toOptionalString(body.tanggalExpire),
    nomorBatch: toOptionalString(body.nomorBatch),
    catatanDetail: toOptionalString(body.catatanDetail),
    alasanSelisih: toOptionalString(body.alasanSelisih),
  };
}

interface InventoryOpnameServicePort {
  listOpname(input: ListInventoryOpnameInput): Promise<unknown>;
  createOpname(input: CreateInventoryOpnameInput): Promise<unknown>;
}

interface CreateOpnameRouteInput {
  user: InventoryUserContext;
  body: InventoryOpnameBody;
}

export type InventoryOpnameRouteResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string };

export class InventoryOpnameRouteService {
  constructor(
    private readonly opnameService: InventoryOpnameServicePort = getInventoryOpnameService(),
  ) {}

  /** Validasi input create opname dari route body. */
  /** Validasi body create opname dan kembalikan payload siap pakai. */
  validateCreateOpnameInput(
    body: InventoryOpnameBody,
  ):
    | CreateOpnameRouteFailure
    | { success: true; data: CreateInventoryOpnamePayload } {
    const { barangId, gudangId, stokFisik } = body;

    if (!barangId || !gudangId || !isNonNegativeNumber(stokFisik)) {
      return {
        success: false,
        status: 400,
        error: "Barang, gudang, dan stok fisik harus diisi dengan benar",
      };
    }

    const kondisiBaik = toOptionalNumber(body.kondisiBaik);
    const kondisiRusak = toOptionalNumber(body.kondisiRusak);
    const kondisiExpire = toOptionalNumber(body.kondisiExpire);
    const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire;

    if (totalKondisi > stokFisik) {
      return {
        success: false,
        status: 400,
        error:
          "Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
      };
    }

    return {
      success: true,
      data: buildCreateOpnamePayload(body),
    };
  }

  /** Buat opname dengan error mapping yang konsisten. */
  async createOpname(
    input: CreateOpnameRouteInput,
  ): Promise<CreateOpnameRouteSuccess | CreateOpnameRouteFailure> {
    const validationResult = this.validateCreateOpnameInput(input.body);
    if ("error" in validationResult) {
      return validationResult;
    }

    try {
      const result = await this.opnameService.createOpname({
        user: input.user,
        ...validationResult.data,
      });

      return { success: true, data: result as CreateInventoryOpnameResult };
    } catch (error: unknown) {
      return this.mapOpnameError(error);
    }
  }

  /** Map domain error dari service ke HTTP response. */
  private mapOpnameError(error: unknown): CreateOpnameRouteFailure {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");

    if (err.message === "Barang tidak ditemukan") {
      return { success: false, status: 404, error: err.message };
    }

    if (err.message === "Gudang tidak ditemukan atau tidak aktif") {
      return { success: false, status: 400, error: err.message };
    }

    if (
      err.message.includes("Akses") ||
      err.message.includes("akses") ||
      err.message.includes("Gudang ini")
    ) {
      return { success: false, status: 403, error: err.message };
    }

    return {
      success: false,
      status: 500,
      error: "Gagal mencatat stock opname",
    };
  }
}

export const inventoryOpnameRouteService = new InventoryOpnameRouteService();
