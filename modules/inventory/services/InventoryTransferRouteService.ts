import type {
  CreateTransferInput,
  InventoryTransferRecord,
  UpdateTransferInput,
} from "../domain/ports/IInventoryOperationRepository";
import type { KondisiBarang } from "../types/asset.enums";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";

const TRANSFER_RESTRICTED_PERMISSIONS = [
  "transfer:site_only",
  "k_barang:site_only",
];

const TRANSFER_NOT_FOUND_ERROR = "Record transfer tidak ditemukan";
const TRANSFER_ACCESS_DENIED_ERROR = "Anda tidak memiliki akses ke data ini";

interface InventoryTransferRepositoryPort {
  findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
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
  resolveRestrictedSiteId(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
    restrictedPermissions: string[];
  }): Promise<string | undefined>;
}

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

interface TransferSiteScopeInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  siteId?: string;
}

export type InventoryTransferRouteResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string };

export class InventoryTransferRouteService {
  constructor(
    private readonly repository: InventoryTransferRepositoryPort = new InventoryRepository(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
  ) {}

  /** Ambil daftar transfer dengan filter dan site restriction. */
  async listTransfers(input: ListTransfersRouteInput) {
    const siteId = await this.resolveTransferSiteId(input);
    const { items: transferList, total } =
      await this.repository.findAllTransfers({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        ...(input.barangId ? { barangId: input.barangId } : {}),
        ...(input.dariGudangId ? { dariGudangId: input.dariGudangId } : {}),
        ...(input.keGudangId ? { keGudangId: input.keGudangId } : {}),
        ...(siteId ? { siteId } : {}),
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

  /** Buat transfer setelah validasi payload. */
  async createTransfer(
    input: CreateTransferRouteInput,
  ): Promise<InventoryTransferRouteResult<InventoryTransferRecord>> {
    const invalidBody = this.validateCreateBody(input.body);
    if (invalidBody) return invalidBody;

    const transfer = await this.repository.createTransfer({
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

    return { success: true, data: transfer };
  }

  /** Ambil detail transfer setelah akses site tervalidasi. */
  async getTransferDetail(
    input: TransferDetailRouteInput,
  ): Promise<
    InventoryTransferRouteResult<{ transfer: InventoryTransferRecord }>
  > {
    const accessible = await this.getAccessibleTransfer(input);
    if (accessible.success === false) return accessible;

    return { success: true, data: { transfer: accessible.data } };
  }

  /** Perbarui keterangan transfer setelah akses site tervalidasi. */
  async updateTransfer(
    input: UpdateTransferRouteInput,
  ): Promise<InventoryTransferRouteResult<InventoryTransferRecord>> {
    const accessible = await this.getAccessibleTransfer(input);
    if (accessible.success === false) return accessible;

    const transfer = await this.repository.updateTransfer(input.id, {
      keterangan: input.body.keterangan as string | undefined,
    });

    return { success: true, data: transfer };
  }

  /** Hapus transfer setelah akses site tervalidasi. */
  async deleteTransfer(
    input: TransferDetailRouteInput,
  ): Promise<InventoryTransferRouteResult<null>> {
    const accessible = await this.getAccessibleTransfer(input);
    if (accessible.success === false) return accessible;

    await this.repository.deleteTransfer(input.id);
    return { success: true, data: null };
  }

  /** Validasi akses site dan kembalikan transfer jika accessible. */
  private async getAccessibleTransfer(
    input: TransferDetailRouteInput,
  ): Promise<InventoryTransferRouteResult<InventoryTransferRecord>> {
    const transfer = await this.repository.findTransferById(input.id);
    if (!transfer) return this.routeError(404, TRANSFER_NOT_FOUND_ERROR);

    const restrictedSiteId = await this.resolveTransferSiteId(input);
    if (!this.canAccessTransferSite(transfer, restrictedSiteId)) {
      return this.routeError(403, TRANSFER_ACCESS_DENIED_ERROR);
    }

    return { success: true, data: transfer };
  }

  /** Cek apakah user bisa akses transfer berdasarkan site gudang sumber/tujuan. */
  private canAccessTransferSite(
    transfer: InventoryTransferRecord,
    restrictedSiteId?: string,
  ) {
    if (!restrictedSiteId) return true;

    const dariSiteIds =
      transfer.gudangDari?.sites?.map((site) => site.id) ||
      transfer.dariGudang?.sites?.map((site) => site.id) ||
      [];
    const keSiteIds =
      transfer.gudangKe?.sites?.map((site) => site.id) ||
      transfer.keGudang?.sites?.map((site) => site.id) ||
      [];

    return (
      dariSiteIds.includes(restrictedSiteId) ||
      keSiteIds.includes(restrictedSiteId)
    );
  }

  private async resolveTransferSiteId(input: TransferSiteScopeInput) {
    return (
      (await this.inventoryRouteService.resolveRestrictedSiteId({
        userId: input.userId,
        permissions: input.permissions,
        isSuperAdmin: input.isSuperAdmin,
        restrictedPermissions: TRANSFER_RESTRICTED_PERMISSIONS,
      })) ?? input.siteId
    );
  }

  private validateCreateBody(body: Record<string, unknown>) {
    const jumlah = Number(body.jumlah);

    if (
      !body.barangId ||
      !body.dariGudangId ||
      !body.keGudangId ||
      !Number.isFinite(jumlah) ||
      jumlah <= 0
    ) {
      return {
        success: false as const,
        status: 400,
        error:
          "Barang, gudang sumber, gudang tujuan, dan jumlah harus diisi dengan benar",
      };
    }

    if (body.dariGudangId === body.keGudangId) {
      return {
        success: false as const,
        status: 400,
        error: "Gudang sumber dan tujuan tidak boleh sama",
      };
    }

    if (body.fotoBukti && !Array.isArray(body.fotoBukti)) {
      return {
        success: false as const,
        status: 400,
        error: "fotoBukti harus berupa array URL foto",
      };
    }

    return null;
  }

  private routeError(
    status: number,
    error: string,
  ): { success: false; status: number; error: string } {
    return { success: false, status, error };
  }
}

export const inventoryTransferRouteService =
  new InventoryTransferRouteService();
