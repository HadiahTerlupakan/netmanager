import { ZodError } from "zod";

import { getInventoryOpnameService } from "./InventoryOpnameService";
import type {
  CreateInventoryOpnameInput,
  CreateInventoryOpnameBatchItem,
  ListInventoryOpnameInput,
} from "./InventoryOpnameService";
import {
  opnameBatchSchema,
  opnameItemSchema,
  type OpnameBatchInput,
  type OpnameBatchItemInput,
  type OpnameItemInput,
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

function zodErrorToFailure(error: ZodError): CreateOpnameRouteFailure {
  const flat = error.flatten((issue) => issue.message);
  const details: Record<string, string[]> = {};

  for (const [path, messages] of Object.entries(flat.fieldErrors)) {
    const list = messages as string[] | undefined;
    if (list && list.length > 0) details[path] = list;
  }
  if (flat.formErrors.length > 0) details["_form"] = flat.formErrors;

  const firstMessage =
    Object.values(details).flat()[0] ?? "Payload opname tidak valid";

  return {
    success: false,
    status: 400,
    error: firstMessage,
    details,
  };
}

function mapOpnameError(error: unknown): CreateOpnameRouteFailure {
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
    err.message.includes("Gudang ini") ||
    err.message.startsWith("SECURITY_BREACH")
  ) {
    return { success: false, status: 403, error: "Akses ditolak" };
  }

  return {
    success: false,
    status: 500,
    error: "Gagal mencatat stock opname",
  };
}

export const inventoryOpnameRouteService = new InventoryOpnameRouteService();
