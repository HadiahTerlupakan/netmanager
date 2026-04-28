import type { KondisiBarang } from "@prisma/client";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { getInventoryRouteService } from "./InventoryRouteService";

const KELUAR_RESTRICTED_PERMISSIONS = [
  "keluar:site_only",
  "k_barang:site_only",
];
const DEFAULT_KONDISI_BARANG = "BARU" as KondisiBarang;

interface InventoryKeluarRepositoryPort {
  getHistoryKeluar(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    search?: string;
    siteId?: string;
  }): Promise<{ items: unknown[]; total: number }>;
  getStockBreakdown(
    barangId: string,
    gudangId: string,
  ): Promise<{ baru: number; bekas: number; rusak: number; total: number }>;
  removeStock(data: {
    barangId: string;
    gudangId: string;
    jumlah: number;
    kondisi: KondisiBarang;
    tujuanPenggunaan?: string;
    keterangan?: string;
    isHilang: boolean;
    fotoBukti: string[];
    fotoMetadata: Record<string, unknown> | null;
    tanggal: Date;
    userId?: string;
  }): Promise<unknown>;
  getStockLevel(barangId: string, gudangId: string): Promise<number>;
}

interface InventoryRouteServicePort {
  resolveRestrictedSiteId(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
    restrictedPermissions: string[];
  }): Promise<string | undefined>;
  getKeluarRecordWithSite(id: string): Promise<KeluarRecordWithSite | null>;
  updateKeluarRecord(input: {
    id: string;
    jumlah: number;
    keterangan?: string;
  }): Promise<KeluarMutationResult>;
  deleteKeluarRecord(id: string): Promise<KeluarMutationResult>;
}

type KeluarRecordWithSite = {
  gudang: { sites?: Array<{ id: string }> };
};

type KeluarMutationResult = {
  barangNama: string;
  jumlahLama?: number;
  jumlah?: number;
};

interface ListKeluarRouteInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  page: number;
  limit: number;
  barangId?: string;
  gudangId?: string;
  search?: string;
  siteId?: string;
}

interface CreateKeluarRouteInput {
  userId: string;
  body: Record<string, unknown>;
}

interface KeluarDetailAccessInput {
  id: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface KeluarUpdateInput extends KeluarDetailAccessInput {
  body: Record<string, unknown>;
}

export type InventoryKeluarRouteResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string };

type KeluarAccessResult =
  | { success: true; record: KeluarRecordWithSite }
  | { success: false; status: number; error: string };

export class InventoryKeluarRouteService {
  constructor(
    private readonly repository: InventoryKeluarRepositoryPort = new InventoryRepository(),
    private readonly inventoryRouteService: InventoryRouteServicePort = getInventoryRouteService(),
  ) {}

  /** Ambil histori barang keluar dengan filter dan site restriction. */
  async listKeluar(input: ListKeluarRouteInput) {
    const siteId = await this.resolveKeluarSiteId(input);
    const { items: keluarList, total } = await this.repository.getHistoryKeluar(
      {
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        ...(input.barangId ? { barangId: input.barangId } : {}),
        ...(input.gudangId ? { gudangId: input.gudangId } : {}),
        ...(input.search ? { search: input.search } : {}),
        ...(siteId ? { siteId } : {}),
      },
    );

    return {
      keluarList,
      pagination: buildPaginationMeta({
        page: input.page,
        limit: input.limit,
        total,
      }),
    };
  }

  /** Ambil stok per kondisi untuk barang di gudang. */
  async getStockBreakdown(barangId: string, gudangId: string) {
    const stock = await this.repository.getStockBreakdown(barangId, gudangId);
    return {
      stokByKondisi: {
        BARU: stock.baru,
        BEKAS: stock.bekas,
        RUSAK: stock.rusak,
        total: stock.total,
      },
    };
  }

  /** Ambil detail barang keluar setelah validasi akses site. */
  async getKeluarDetail(
    input: KeluarDetailAccessInput,
  ): Promise<InventoryKeluarRouteResult<{ keluar: KeluarRecordWithSite }>> {
    const accessCheck = await this.validateKeluarAccess(input);
    if (accessCheck.success === false) return accessCheck;

    return { success: true as const, data: { keluar: accessCheck.record } };
  }

  /** Ubah barang keluar setelah validasi akses dan payload. */
  async updateKeluar(
    input: KeluarUpdateInput,
  ): Promise<
    InventoryKeluarRouteResult<{ result: KeluarMutationResult; jumlah: number }>
  > {
    const accessCheck = await this.validateKeluarAccess(input);
    if (accessCheck.success === false) return accessCheck;

    const jumlah = Number(input.body.jumlah);
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      return {
        success: false as const,
        status: 400,
        error: "Jumlah harus diisi dengan angka positif",
      };
    }

    const result = await this.inventoryRouteService.updateKeluarRecord({
      id: input.id,
      jumlah,
      keterangan: input.body.keterangan as string | undefined,
    });
    return { success: true as const, data: { result, jumlah } };
  }

  /** Hapus barang keluar setelah validasi akses site. */
  async deleteKeluar(
    input: KeluarDetailAccessInput,
  ): Promise<InventoryKeluarRouteResult<KeluarMutationResult>> {
    const accessCheck = await this.validateKeluarAccess(input);
    if (accessCheck.success === false) return accessCheck;

    const result = await this.inventoryRouteService.deleteKeluarRecord(
      input.id,
    );
    return { success: true as const, data: result };
  }

  /** Catat barang keluar setelah validasi payload. */
  async createKeluar(input: CreateKeluarRouteInput): Promise<
    InventoryKeluarRouteResult<{
      keluarRecord: unknown;
      finalStock: number;
      parsedJumlah: number;
    }>
  > {
    const invalidBody = this.validateCreateBody(input.body);
    if (invalidBody) return invalidBody;

    const parsedJumlah = Number(input.body.jumlah);
    const barangId = String(input.body.barangId);
    const gudangId = String(input.body.gudangId);
    const keluarRecord = await this.repository.removeStock({
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      kondisi:
        (input.body.kondisi as KondisiBarang | undefined) ||
        DEFAULT_KONDISI_BARANG,
      tujuanPenggunaan: input.body.tujuanPenggunaan as string | undefined,
      keterangan: input.body.keterangan as string | undefined,
      isHilang: Boolean(input.body.isHilang),
      fotoBukti: (input.body.fotoBukti as string[] | undefined) || [],
      fotoMetadata:
        (input.body.fotoMetadata as Record<string, unknown> | undefined) ||
        null,
      tanggal: new Date(),
      userId: input.userId,
    });
    const finalStock = await this.repository.getStockLevel(barangId, gudangId);

    return {
      success: true,
      data: { keluarRecord, finalStock, parsedJumlah },
    };
  }

  private async resolveKeluarSiteId(input: ListKeluarRouteInput) {
    return (await this.resolveRestrictedKeluarSiteId(input)) ?? input.siteId;
  }

  private async resolveRestrictedKeluarSiteId(input: {
    userId: string;
    permissions: string[];
    isSuperAdmin: boolean;
  }) {
    return this.inventoryRouteService.resolveRestrictedSiteId({
      userId: input.userId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      restrictedPermissions: KELUAR_RESTRICTED_PERMISSIONS,
    });
  }

  private async validateKeluarAccess(
    input: KeluarDetailAccessInput,
  ): Promise<KeluarAccessResult> {
    const record = await this.inventoryRouteService.getKeluarRecordWithSite(
      input.id,
    );
    if (!record) {
      return {
        success: false as const,
        status: 404,
        error: "Record barang keluar",
      };
    }

    const restrictedSiteId = await this.resolveRestrictedKeluarSiteId(input);
    if (!restrictedSiteId) {
      return { success: true as const, record };
    }

    const gudangSiteIds = record.gudang.sites?.map((site) => site.id) || [];
    if (!gudangSiteIds.includes(restrictedSiteId)) {
      return {
        success: false as const,
        status: 403,
        error: "Anda tidak memiliki akses ke data ini",
      };
    }

    return { success: true as const, record };
  }

  private validateCreateBody(body: Record<string, unknown>) {
    const parsedJumlah = Number(body.jumlah);

    if (
      !body.barangId ||
      !body.gudangId ||
      !Number.isFinite(parsedJumlah) ||
      parsedJumlah <= 0
    ) {
      return {
        success: false as const,
        status: 400,
        error: "Barang, gudang, dan jumlah harus diisi dengan benar",
      };
    }

    if (body.kondisi && !this.isValidKondisi(body.kondisi)) {
      return {
        success: false as const,
        status: 400,
        error: "Kondisi tidak valid. Pilih: BARU, BEKAS, atau RUSAK",
      };
    }

    if (body.fotoBukti && !Array.isArray(body.fotoBukti)) {
      return {
        success: false as const,
        status: 400,
        error: "fotoBukti harus berupa array URL foto",
      };
    }

    if (body.fotoMetadata && typeof body.fotoMetadata !== "object") {
      return {
        success: false as const,
        status: 400,
        error: "fotoMetadata harus berupa object JSON",
      };
    }

    return null;
  }

  private isValidKondisi(kondisi: unknown): kondisi is KondisiBarang {
    return kondisi === "BARU" || kondisi === "BEKAS" || kondisi === "RUSAK";
  }
}

export const inventoryKeluarRouteService = new InventoryKeluarRouteService();
