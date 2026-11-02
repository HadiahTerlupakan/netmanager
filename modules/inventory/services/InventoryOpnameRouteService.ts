import { ZodError } from "zod";

import { logger } from "@/lib/logger";

import { OPNAME_BEDA_SITE_ERROR, OPNAME_PESAN } from "../domain/opname-pesan";
import { getInventoryOpnameService } from "./InventoryOpnameService";
import type {
  CreateInventoryOpnameInput,
  CreateInventoryOpnameBatchItem,
  ListInventoryOpnameInput,
} from "./InventoryOpnameService";
import {
  opnameBatchSchema,
  opnameItemSchema,
  opnameUpdateSchema,
  type OpnameBatchInput,
  type OpnameBatchItemInput,
  type OpnameItemInput,
  type OpnameUpdateInput,
} from "../validators/opnameValidator";

type CreateInventoryOpnamePayload = Omit<CreateInventoryOpnameInput, "user">;

type CreateInventoryOpnameResult = {
  previousStock: number;
  newStock: number;
  selisih: number;
  opnameRecord: { id: string; [key: string]: unknown };
};

type CreateInventoryOpnameResultWithBarangId = CreateInventoryOpnameResult & {
  barangId: string;
};

interface InventoryUserContext {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  permissions?: string[];
  siteId?: string | null;
}

interface CreateOpnameRouteSuccess {
  success: true;
  data: CreateInventoryOpnameResult;
}

interface CreateOpnameRouteFailure {
  success: false;
  status: number;
  error: string;
  details?: Record<string, string[]>;
}

interface BatchOpnameRouteSuccess {
  success: true;
  data: {
    totalItems: number;
    results: CreateInventoryOpnameResultWithBarangId[];
  };
}

export type CreateOpnameRouteResult =
  | CreateOpnameRouteSuccess
  | CreateOpnameRouteFailure;

export type BatchOpnameRouteResult =
  | BatchOpnameRouteSuccess
  | CreateOpnameRouteFailure;

interface InventoryOpnameServicePort {
  listOpname(input: ListInventoryOpnameInput): Promise<unknown>;
  createOpname(input: CreateInventoryOpnameInput): Promise<unknown>;
  createOpnameBatch(input: {
    user: InventoryUserContext;
    gudangId: string;
    items: CreateInventoryOpnameBatchItem[];
  }): Promise<CreateInventoryOpnameResultWithBarangId[]>;
}

interface CreateOpnameRouteInput {
  user: InventoryUserContext;
  body: unknown;
}

interface BatchOpnameRouteInput {
  user: InventoryUserContext;
  body: unknown;
}

export class InventoryOpnameRouteService {
  constructor(
    private readonly opnameService: InventoryOpnameServicePort = getInventoryOpnameService() as unknown as InventoryOpnameServicePort,
  ) {}
  /** Buat satu opname dengan validasi Zod dan error mapping. */
  async createOpname(
    input: CreateOpnameRouteInput,
  ): Promise<CreateOpnameRouteSuccess | CreateOpnameRouteFailure> {
    const parsed = this.parseSingleItem(input.body);
    if (parsed.ok === false) return parsed.failure;

    try {
      const result = await this.opnameService.createOpname({
        user: input.user,
        ...this.toServicePayload(parsed.data),
      });

      return { success: true, data: result as CreateInventoryOpnameResult };
    } catch (error: unknown) {
      return mapOpnameError(error);
    }
  }

  /** Buat banyak opname dalam satu transaksi. */
  async createOpnameBatch(
    input: BatchOpnameRouteInput,
  ): Promise<BatchOpnameRouteResult> {
    const parsed = this.parseBatch(input.body);
    if (parsed.ok === false) return parsed.failure;

    try {
      const results = await this.opnameService.createOpnameBatch({
        user: input.user,
        gudangId: parsed.data.gudangId,
        items: parsed.data.items.map((item) => this.toBatchItemPayload(item)),
      });

      return {
        success: true,
        data: { totalItems: results.length, results },
      };
    } catch (error: unknown) {
      return mapOpnameError(error);
    }
  }

  /** Validasi body PUT opname dengan pesan per kolom yang dibaca petugas. */
  parseOpnameUpdate(
    body: unknown,
  ):
    | { ok: true; data: OpnameUpdateInput }
    | { ok: false; failure: CreateOpnameRouteFailure } {
    const result = opnameUpdateSchema.safeParse(body);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, failure: zodErrorToFailure(result.error) };
  }

  private parseSingleItem(
    body: unknown,
  ):
    | { ok: true; data: OpnameItemInput }
    | { ok: false; failure: CreateOpnameRouteFailure } {
    const result = opnameItemSchema.safeParse(body);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, failure: zodErrorToFailure(result.error) };
  }

  private parseBatch(
    body: unknown,
  ):
    | { ok: true; data: OpnameBatchInput }
    | { ok: false; failure: CreateOpnameRouteFailure } {
    const result = opnameBatchSchema.safeParse(body);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, failure: zodErrorToFailure(result.error) };
  }

  private toServicePayload(
    item: OpnameItemInput,
  ): CreateInventoryOpnamePayload {
    return {
      barangId: item.barangId,
      gudangId: item.gudangId,
      stokFisik: item.stokFisik,
      keterangan: item.keterangan,
      kondisiBaik: item.kondisiBaik ?? 0,
      kondisiRusak: item.kondisiRusak ?? 0,
      kondisiExpire: item.kondisiExpire ?? 0,
      lokasiPenyimpanan: item.lokasiPenyimpanan,
      nomorRak: item.nomorRak,
      nomorBox: item.nomorBox,
      suhuPenyimpanan: item.suhuPenyimpanan,
      kelembaban: item.kelembaban,
      tanggalExpire: item.tanggalExpire,
      nomorBatch: item.nomorBatch,
      catatanDetail: item.catatanDetail,
      alasanSelisih: item.alasanSelisih,
    };
  }

  private toBatchItemPayload(
    item: OpnameBatchItemInput,
  ): CreateInventoryOpnameBatchItem {
    return {
      barangId: item.barangId,
      stokFisik: item.stokFisik,
      keterangan: item.keterangan,
      kondisiBaik: item.kondisiBaik ?? 0,
      kondisiRusak: item.kondisiRusak ?? 0,
      kondisiExpire: item.kondisiExpire ?? 0,
      lokasiPenyimpanan: item.lokasiPenyimpanan,
      nomorRak: item.nomorRak,
      nomorBox: item.nomorBox,
      suhuPenyimpanan: item.suhuPenyimpanan,
      kelembaban: item.kelembaban,
      tanggalExpire: item.tanggalExpire,
      nomorBatch: item.nomorBatch,
      catatanDetail: item.catatanDetail,
      alasanSelisih: item.alasanSelisih,
    };
  }
}

/**
 * Ubah error validasi menjadi pesan untuk petugas. Masalah pada barang dalam
 * batch disebut "Barang ke-N" dan dikunci di `details["items.<index>"]`, agar
 * layar bisa menggantinya dengan nama barang. Semua masalah dilaporkan sekaligus
 * supaya petugas tidak membetulkan satu per satu lalu gagal lagi.
 */
function zodErrorToFailure(error: ZodError): CreateOpnameRouteFailure {
  const details: Record<string, string[]> = {};
  const lines: string[] = [];

  for (const issue of error.issues) {
    const [root, index] = issue.path;
    const isBatchItem = root === "items" && typeof index === "number";
    const key = isBatchItem ? `items.${index}` : "_form";
    const existing = details[key] ?? [];
    if (existing.includes(issue.message)) continue;

    details[key] = [...existing, issue.message];
    lines.push(
      isBatchItem ? `Barang ke-${index + 1}: ${issue.message}` : issue.message,
    );
  }

  return {
    success: false,
    status: 400,
    error: lines.join("\n") || OPNAME_PESAN.dataTidakTerbaca,
    details,
  };
}

interface OpnameErrorTranslation {
  matches: (message: string) => boolean;
  status: number;
  message: string;
}

/**
 * Terjemahan error service ke pesan petugas, dicek berurutan. Pesan asli
 * ditulis untuk programmer; petugas perlu tahu apa yang terjadi dan langkah
 * berikutnya.
 */
const OPNAME_ERROR_TRANSLATIONS: readonly OpnameErrorTranslation[] = [
  {
    matches: (m) => m.startsWith("Record stock opname tidak ditemukan"),
    status: 404,
    message: OPNAME_PESAN.catatanTidakDitemukan,
  },
  {
    matches: (m) => m.startsWith("Akses ditolak: record bukan milik"),
    status: 403,
    message: OPNAME_PESAN.catatanBukanMilikAnda,
  },
  {
    matches: (m) => m === OPNAME_BEDA_SITE_ERROR,
    status: 403,
    message: OPNAME_PESAN.catatanBedaSite,
  },
  {
    matches: (m) => m === "Barang tidak ditemukan",
    status: 404,
    message:
      "Ada barang yang tidak ditemukan, mungkin baru dihapus. Muat ulang halaman, lalu hitung dan simpan lagi.",
  },
  {
    matches: (m) => m.startsWith("Gudang tidak ditemukan"),
    status: 400,
    message:
      "Gudang ini sudah dihapus atau dinonaktifkan. Pilih gudang lain, atau minta admin mengaktifkannya lagi.",
  },
  {
    matches: (m) => m.includes("(Beda Site)"),
    status: 403,
    message:
      "Gudang ini milik site lain, jadi Anda tidak bisa mencatat opname di sini. Pilih gudang di site Anda, atau minta admin menambahkan site gudang ini ke akun Anda.",
  },
  {
    matches: (m) => m.startsWith("User tidak memiliki Site"),
    status: 403,
    message:
      "Akun Anda belum ditugaskan ke site mana pun, jadi belum bisa mencatat opname. Minta admin mengatur site di akun Anda.",
  },
  {
    matches: (m) => m.startsWith("SECURITY_BREACH"),
    status: 403,
    message:
      "Akun Anda belum terhubung ke perusahaan mana pun, jadi belum bisa mencatat opname. Minta admin memeriksa akun Anda.",
  },
  {
    matches: (m) => m.includes("tenant yang sama"),
    status: 400,
    message:
      "Ada barang yang bukan milik gudang ini. Muat ulang halaman lalu coba lagi. Kalau masih muncul, laporkan ke admin.",
  },
  {
    matches: (m) => /akses/i.test(m),
    status: 403,
    message:
      "Anda tidak punya izin mencatat opname di gudang ini. Minta admin memeriksa hak akses akun Anda.",
  },
];

/**
 * Terjemahkan error service opname ke pesan petugas. Error yang tidak dikenal
 * dicatat utuh di log dan dijawab 500 dengan `serverErrorMessage`.
 */
export function mapOpnameError(
  error: unknown,
  serverErrorMessage: string = OPNAME_PESAN.gagalSimpan,
): CreateOpnameRouteFailure {
  const err = error instanceof Error ? error : new Error(String(error));
  const translation = OPNAME_ERROR_TRANSLATIONS.find((t) =>
    t.matches(err.message),
  );
  if (translation) {
    return {
      success: false,
      status: translation.status,
      error: translation.message,
    };
  }

  // Penyebab asli hanya untuk log; petugas mendapat pesan yang bisa ditindaklanjuti.
  logger.error("Stock opname gagal diproses", err);
  return { success: false, status: 500, error: serverErrorMessage };
}

export const inventoryOpnameRouteService = new InventoryOpnameRouteService();
