import type {
  CreateTransferInput,
  InventoryTransferRecord,
  UpdateTransferInput,
} from "../domain/ports/IInventoryOperationRepository";
import type { KondisiBarang } from "../types/asset.enums";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";
import type { LingkupSite } from "@/modules/roles/client";

import { IZIN_PEMBATAS_TRANSFER } from "../domain/izin-pembatas-site";
import type { ResolveLingkupSiteInput } from "./InventoryRouteService";
import { gudangDalamLingkup, siteIdsSaringan } from "./lingkup-gudang";
import {
  isTransferRejectedError,
  TRANSFER_MESSAGES,
} from "../domain/transfer-errors";
import { isValidKondisi } from "./inventory-route-validation.helpers";

export {
  TRANSFER_MESSAGES,
  TransferRejectedError,
  isTransferRejectedError,
} from "../domain/transfer-errors";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";

const PRISMA_RECORD_NOT_FOUND = "P2025";

interface InventoryTransferRepositoryPort {
  findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteIds?: string[];
  }): Promise<{ items: InventoryTransferRecord[]; total: number }>;
  createTransfer(
    data: Omit<CreateTransferInput, "tenantId">,
  ): Promise<InventoryTransferRecord>;
  findTransferById(id: string): Promise<InventoryTransferRecord | null>;
  updateTransfer(
    id: string,
    data: UpdateTransferInput,
  ): Promise<InventoryTransferRecord>;
  deleteTransfer(id: string): Promise<void>;
}

interface InventoryRouteServicePort {
  resolveLingkupSite(input: ResolveLingkupSiteInput): Promise<LingkupSite>;
}

/**
 * Sisi gudang yang wajib di dalam lingkup site pengguna.
 *
 * - `salah-satu`: membaca detail — transfer memang terlihat di daftar kedua site;
 * - `keduanya`: ubah/hapus — menghapus transfer membalik stok di gudang asal
 *   DAN tujuan, jadi aturannya sama dengan saat membuatnya.
 */
type SisiGudangWajib = "salah-satu" | "keduanya";

interface ListTransfersRouteInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  page: number;
  limit: number;
  barangId?: string;
  dariGudangId?: string;
  keGudangId?: string;
  siteId?: string;
}

interface CreateTransferRouteInput {
  userId: string;
  body: Record<string, unknown>;
}

interface TransferDetailRouteInput {
  id: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface UpdateTransferRouteInput extends TransferDetailRouteInput {
  body: Record<string, unknown>;
}

export type InventoryTransferRouteResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string };

type TransferRouteFailure = { success: false; status: number; error: string };

export class InventoryTransferRouteService {
  constructor(
    private readonly repository: InventoryTransferRepositoryPort = new InventoryRepository(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
  ) {}

  /** Ambil daftar transfer dengan filter dan site restriction. */
  async listTransfers(input: ListTransfersRouteInput) {
    const lingkup = await this.resolveTransferLingkup(input);
    const siteIds = siteIdsSaringan(lingkup, input.siteId);
    const { items: transferList, total } =
      await this.repository.findAllTransfers({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        ...(input.barangId ? { barangId: input.barangId } : {}),
        ...(input.dariGudangId ? { dariGudangId: input.dariGudangId } : {}),
        ...(input.keGudangId ? { keGudangId: input.keGudangId } : {}),
        ...(siteIds ? { siteIds } : {}),
      });

    return {
      transferList,
      pagination: buildPaginationMeta({
        page: input.page,
        limit: input.limit,
        total,
      }),
    };
  }

  /**
   * Periksa isian formulir transfer. Semua masalah dilaporkan sekaligus,
   * satu per baris, agar petugas tidak membetulkan satu lalu gagal lagi.
   * Dipanggil route sebelum cek akses gudang, agar gudang kosong tidak
   * sampai ke database.
   */
  validateCreateTransferBody(
    body: Record<string, unknown>,
  ): TransferRouteFailure | null {
    const problems = [
      ...collectRequiredFieldProblems(body),
      ...collectJumlahProblems(body.jumlah),
      ...collectOptionalFieldProblems(body),
    ];
    if (problems.length === 0) return null;
    return this.routeError(400, problems.join("\n"));
  }

  /** Buat transfer setelah validasi payload. */
  async createTransfer(
    input: CreateTransferRouteInput,
  ): Promise<InventoryTransferRouteResult<InventoryTransferRecord>> {
    const invalidBody = this.validateCreateTransferBody(input.body);
    if (invalidBody) return invalidBody;

    try {
      const transfer = await this.createTransferRecord(input);
      return { success: true, data: transfer };
    } catch (error: unknown) {
      return this.toRejectionOrThrow(error);
    }
  }

  private createTransferRecord(input: CreateTransferRouteInput) {
    return this.repository.createTransfer({
      barangId: String(input.body.barangId),
      dariGudangId: String(input.body.dariGudangId),
      keGudangId: String(input.body.keGudangId),
      jumlah: Number(input.body.jumlah),
      kondisi: input.body.kondisi as KondisiBarang | undefined,
      keterangan: input.body.keterangan as string | undefined,
      userId: input.userId,
      fotoBukti: input.body.fotoBukti as string[] | undefined,
      fotoMetadata: input.body.fotoMetadata as
        | Record<string, unknown>
        | undefined,
    });
  }

  /** Ambil detail transfer setelah akses site tervalidasi. */
  async getTransferDetail(
    input: TransferDetailRouteInput,
  ): Promise<
    InventoryTransferRouteResult<{ transfer: InventoryTransferRecord }>
  > {
    const accessible = await this.getAccessibleTransfer(input, "salah-satu");
    if (accessible.success === false) return accessible;

    return { success: true, data: { transfer: accessible.data } };
  }

  /** Perbarui keterangan transfer setelah akses site tervalidasi. */
  async updateTransfer(
    input: UpdateTransferRouteInput,
  ): Promise<InventoryTransferRouteResult<InventoryTransferRecord>> {
    const rawKeterangan = input.body.keterangan;
    if (rawKeterangan != null && typeof rawKeterangan !== "string") {
      return this.routeError(400, TRANSFER_MESSAGES.keteranganBukanTulisan);
    }
    const keterangan =
      typeof rawKeterangan === "string" ? rawKeterangan : undefined;

    const accessible = await this.getAccessibleTransfer(input, "keduanya");
    if (accessible.success === false) return accessible;

    let transfer: InventoryTransferRecord;
    try {
      transfer = await this.repository.updateTransfer(input.id, {
        keterangan,
      });
    } catch (error: unknown) {
      if (isPrismaRecordNotFound(error)) {
        return this.routeError(404, TRANSFER_MESSAGES.transferTidakAda);
      }
      throw error;
    }

    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.UPDATE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.TRANSFER,
      reference: accessible.data.kodeTransfer,
      actorId: input.userId,
      tenantId: accessible.data.tenantId,
      details: {
        transferId: input.id,
        keteranganLama: accessible.data.keterangan,
        keteranganBaru: transfer.keterangan,
      },
    });
    return { success: true, data: transfer };
  }

  /** Hapus transfer setelah akses site tervalidasi. */
  async deleteTransfer(
    input: TransferDetailRouteInput,
  ): Promise<InventoryTransferRouteResult<null>> {
    const accessible = await this.getAccessibleTransfer(input, "keduanya");
    if (accessible.success === false) return accessible;

    try {
      await this.repository.deleteTransfer(input.id);
    } catch (error: unknown) {
      return this.toRejectionOrThrow(error);
    }
    const deleted = accessible.data;
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.DELETE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.TRANSFER,
      reference: deleted.kodeTransfer,
      actorId: input.userId,
      tenantId: deleted.tenantId,
      details: {
        transferId: deleted.id,
        barangId: deleted.barangId,
        dariGudangId: deleted.dariGudangId,
        keGudangId: deleted.keGudangId,
        jumlah: deleted.jumlah,
        kondisi: deleted.kondisi,
      },
    });
    return { success: true, data: null };
  }

  /** Validasi akses site dan kembalikan transfer jika accessible. */
  private async getAccessibleTransfer(
    input: TransferDetailRouteInput,
    sisiWajib: SisiGudangWajib,
  ): Promise<InventoryTransferRouteResult<InventoryTransferRecord>> {
    const transfer = await this.repository.findTransferById(input.id);
    if (!transfer) {
      return this.routeError(404, TRANSFER_MESSAGES.transferTidakAda);
    }

    const lingkup = await this.resolveTransferLingkup(input);
    if (!this.canAccessTransferSite(transfer, lingkup, "salah-satu")) {
      return this.routeError(403, TRANSFER_MESSAGES.transferBedaSite);
    }
    if (!this.canAccessTransferSite(transfer, lingkup, sisiWajib)) {
      return this.routeError(403, TRANSFER_MESSAGES.transferSebagianBedaSite);
    }

    return { success: true, data: transfer };
  }

  /** Cek akses transfer berdasarkan site gudang sumber/tujuan. */
  private canAccessTransferSite(
    transfer: InventoryTransferRecord,
    lingkup: LingkupSite,
    sisiWajib: SisiGudangWajib,
  ) {
    const dariSiteIds =
      transfer.gudangDari?.sites?.map((site) => site.id) ||
      transfer.dariGudang?.sites?.map((site) => site.id) ||
      [];
    const keSiteIds =
      transfer.gudangKe?.sites?.map((site) => site.id) ||
      transfer.keGudang?.sites?.map((site) => site.id) ||
      [];

    const bolehDari = gudangDalamLingkup(lingkup, dariSiteIds);
    const bolehKe = gudangDalamLingkup(lingkup, keSiteIds);
    return sisiWajib === "keduanya"
      ? bolehDari && bolehKe
      : bolehDari || bolehKe;
  }

  private resolveTransferLingkup(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
  }) {
    return this.inventoryRouteService.resolveLingkupSite({
      userId: input.userId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      restrictedPermissions: IZIN_PEMBATAS_TRANSFER,
    });
  }

  /** Penolakan transfer menjadi hasil gagal; error lain dilempar ke route (500). */
  private toRejectionOrThrow(error: unknown): TransferRouteFailure {
    if (isTransferRejectedError(error)) {
      return this.routeError(error.status, error.message);
    }
    throw error;
  }

  private routeError(
    status: number,
    error: string,
  ): { success: false; status: number; error: string } {
    return { success: false, status, error };
  }
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function collectRequiredFieldProblems(body: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (isBlank(body.barangId)) problems.push(TRANSFER_MESSAGES.barangKosong);
  if (isBlank(body.dariGudangId)) {
    problems.push(TRANSFER_MESSAGES.gudangAsalKosong);
  }
  if (isBlank(body.keGudangId)) {
    problems.push(TRANSFER_MESSAGES.gudangTujuanKosong);
  }
  if (!isBlank(body.dariGudangId) && body.dariGudangId === body.keGudangId) {
    problems.push(TRANSFER_MESSAGES.gudangSama);
  }
  return problems;
}

function collectJumlahProblems(rawJumlah: unknown): string[] {
  if (isBlank(rawJumlah)) return [TRANSFER_MESSAGES.jumlahKosong];
  const jumlah = Number(rawJumlah);
  if (!Number.isFinite(jumlah)) return [TRANSFER_MESSAGES.jumlahBukanAngka];
  if (jumlah <= 0) return [TRANSFER_MESSAGES.jumlahTidakPositif];
  if (!Number.isInteger(jumlah)) return [TRANSFER_MESSAGES.jumlahBerkoma];
  return [];
}

function collectOptionalFieldProblems(body: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (body.kondisi && !isValidKondisi(body.kondisi)) {
    problems.push(TRANSFER_MESSAGES.kondisiTidakDikenal);
  }
  if (body.fotoBukti && !Array.isArray(body.fotoBukti)) {
    problems.push(TRANSFER_MESSAGES.fotoTidakTerbaca);
  }
  if (body.keterangan != null && typeof body.keterangan !== "string") {
    problems.push(TRANSFER_MESSAGES.keteranganBukanTulisan);
  }
  return problems;
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === PRISMA_RECORD_NOT_FOUND
  );
}

export const inventoryTransferRouteService =
  new InventoryTransferRouteService();
