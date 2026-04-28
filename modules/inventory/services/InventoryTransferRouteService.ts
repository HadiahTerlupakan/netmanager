import type { KondisiBarang } from "@prisma/client";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";

const TRANSFER_RESTRICTED_PERMISSIONS = [
  "transfer:site_only",
  "k_barang:site_only",
];

interface InventoryTransferRepositoryPort {
  findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
  }): Promise<{ items: Record<string, unknown>[]; total: number }>;
  createTransfer(data: {
    barangId: string;
    dariGudangId: string;
    keGudangId: string;
    jumlah: number;
    kondisi?: KondisiBarang;
    keterangan?: string;
    userId: string;
    fotoBukti?: string[];
    fotoMetadata?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  findTransferById(id: string): Promise<Record<string, unknown> | null>;
  updateTransfer(
    id: string,
    data: { keterangan?: string },
  ): Promise<Record<string, unknown>>;
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

interface UpdateTransferRouteInput {
  id: string;
  body: Record<string, unknown>;
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
  ): Promise<InventoryTransferRouteResult<Record<string, unknown>>> {
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

  /** Ambil detail transfer berdasarkan id. */
  async getTransferDetail(id: string) {
    const transfer = await this.repository.findTransferById(id);
    if (!transfer) return { found: false as const };

    return { found: true as const, transfer };
  }

  /** Perbarui keterangan transfer. */
  async updateTransfer(
    input: UpdateTransferRouteInput,
  ): Promise<InventoryTransferRouteResult<Record<string, unknown>>> {
    const transfer = await this.repository.updateTransfer(input.id, {
      keterangan: input.body.keterangan as string | undefined,
    });

    return { success: true, data: transfer };
  }

  /** Hapus transfer dan rollback stok via repository. */
  async deleteTransfer(
    id: string,
  ): Promise<InventoryTransferRouteResult<null>> {
    await this.repository.deleteTransfer(id);
    return { success: true, data: null };
  }

  private async resolveTransferSiteId(input: ListTransfersRouteInput) {
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
}

export const inventoryTransferRouteService =
  new InventoryTransferRouteService();
