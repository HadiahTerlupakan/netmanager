import type { KondisiBarang } from "@prisma/client";
import { isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { InventoryRepository } from "../repositories/InventoryRepository";
import type { InventoryActorInput } from "../repositories/IInventoryRepository";
import {
  buildInventoryActorFilter,
  resolveInventoryActorScope,
  validateInventoryGudangAccess,
} from "../utils/validation";

const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_KONDISI_BARANG = "BARU" as KondisiBarang;

export class MobileInventoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface MobileInventoryRepository {
  findMobileActorUser(
    input: MobileActorLookupInput,
  ): Promise<MobileActorUser | null>;
  findMobileActorMitra(actorId: string): Promise<MobileActorMitra | null>;
  findMobileGudangs(input: MobileSiteScopedInput): Promise<MobileGudangItem[]>;
  findMobileBarangForMasuk(
    input: MobileSiteScopedInput,
  ): Promise<MobileBarangMaster[]>;
  findMobileBarangForKeluar(
    input: MobileBarangKeluarLookupInput,
  ): Promise<MobileBarangStock[]>;
  findMobileGudangSites(
    input: MobileGudangLookupInput,
  ): Promise<MobileGudangSites | null>;
  findMobileBarangGudangStock(
    input: MobileBarangGudangStockInput,
  ): Promise<MobileBarangGudangStock | null>;
  findMobileHistoryMasuk(
    input: MobileHistoryLookupInput,
  ): Promise<MobileHistoryRecord[]>;
  findMobileHistoryKeluar(
    input: MobileHistoryLookupInput,
  ): Promise<MobileHistoryRecord[]>;
  addStock(input: MobileAddStockInput): Promise<unknown>;
  removeStock(input: MobileRemoveStockInput): Promise<unknown>;
  getStockLevel(barangId: string, gudangId: string): Promise<number>;
}

export interface MobileGudangItem {
  id: string;
  kode: string;
  nama: string;
  lokasi: string | null;
}

interface MobileActorLookupInput {
  actorId: string;
  tenantId: string;
}

interface MobileSiteScopedInput {
  tenantId: string;
  siteIds?: string[];
}

interface MobileBarangKeluarLookupInput extends MobileSiteScopedInput {
  gudangId: string;
}

interface MobileGudangLookupInput {
  gudangId: string;
  tenantId: string;
}

interface MobileBarangGudangStockInput extends MobileGudangLookupInput {
  barangId: string;
}

interface MobileActorUser {
  id: string;
  role?: {
    name?: string | null;
    permission?: Array<{ resource: string; action: string }>;
  } | null;
  sites?: { id: string } | null;
  userSites?: Array<{ siteId: string }> | null;
}

interface MobileActorMitra {
  id: string;
  siteId?: string | null;
}

interface MobileGudangSites {
  id: string;
  sites: Array<{ id: string }>;
}

interface MobileBarangMaster {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial: boolean;
}

interface MobileBarangStock {
  barang: MobileBarangMaster;
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
}

interface MobileBarangGudangStock {
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  barang?: { nama: string } | null;
}

interface MobileHistoryRecord {
  id: string;
  barang: { kode: string; nama: string; satuan: string };
  gudang: { nama: string };
  jumlah: number;
  kondisi: string | null;
  keterangan: string | null;
  tanggal: Date;
}

interface MobileHistoryItem extends Omit<MobileHistoryRecord, "tanggal"> {
  type: "masuk" | "keluar";
  tanggal: string;
  rawDate?: Date;
}

interface MobileAddStockInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: KondisiBarang;
  keterangan?: string;
  supplier?: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown> | null;
  actor?: InventoryActorInput;
  tanggal?: Date;
  tenantId?: string;
}

interface MobileRemoveStockInput extends Omit<MobileAddStockInput, "supplier"> {
  kondisi: KondisiBarang;
  tujuanPenggunaan?: string;
}

interface MobileCommandInput {
  actorId: string;
  tenantId: string;
  barangId: string;
  gudangId: string;
  jumlah: unknown;
  kondisi?: KondisiBarang;
  keterangan?: string;
  supplier?: string;
  tujuanPenggunaan?: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown> | null;
}

interface MobileHistoryLookupInput {
  tenantId: string;
  where: Record<string, unknown>;
  take: number;
}

export class MobileInventoryService {
  constructor(
    private readonly repository: MobileInventoryRepository = new InventoryRepository(),
  ) {}

  /** Mengambil daftar gudang mobile sesuai scope site actor. */
  async getGudangs(input: MobileActorLookupInput): Promise<MobileGudangItem[]> {
    const scope = await this.requireActorScope(input);
    this.ensureAssignedSite(scope);

    return this.repository.findMobileGudangs({
      tenantId: input.tenantId,
      siteIds: this.getScopedSiteIds(scope),
    });
  }

  /** Mengambil daftar barang mobile untuk mode masuk atau keluar. */
  async getBarang(input: {
    actorId: string;
    tenantId: string;
    gudangId?: string | null;
    mode: string;
  }) {
    const scope = await this.requireActorScope(input);
    this.ensureAssignedSite(scope);

    if (input.mode === "masuk") {
      return this.mapBarangMaster(
        await this.repository.findMobileBarangForMasuk({
          tenantId: input.tenantId,
          siteIds: this.getScopedSiteIds(scope),
        }),
      );
    }

    if (!input.gudangId) {
      throw new MobileInventoryError("gudangId required", 400);
    }

    return this.mapBarangStock(
      await this.repository.findMobileBarangForKeluar({
        tenantId: input.tenantId,
        gudangId: input.gudangId,
        siteIds: this.getScopedSiteIds(scope),
      }),
    );
  }

  /** Mencatat barang masuk mobile setelah validasi scope gudang. */
  async createBarangMasuk(input: MobileCommandInput) {
    const jumlah = this.parseJumlah(input.jumlah);
    const scope = await this.requireActorScope(input);
    await this.ensureGudangAccess(input, scope);
    const result = await this.repository.addStock({
      barangId: input.barangId,
      gudangId: input.gudangId,
      jumlah,
      kondisi: input.kondisi || DEFAULT_KONDISI_BARANG,
      keterangan: input.keterangan,
      supplier: input.supplier,
      fotoBukti: input.fotoBukti || [],
      fotoMetadata: input.fotoMetadata || null,
      actor: scope.actor,
      tenantId: input.tenantId,
      tanggal: new Date(),
    });

    socketEmitter.inventoryUpdate({
      type: "masuk",
      userId: scope.actor.id,
      barangId: input.barangId,
      gudangId: input.gudangId,
      jumlah,
    });

    return result;
  }

  /** Mencatat barang keluar mobile setelah validasi scope gudang dan stok. */
  async createBarangKeluar(input: MobileCommandInput) {
    const jumlah = this.parseJumlah(input.jumlah);
    const scope = await this.requireActorScope(input);
    await this.ensureGudangAccess(input, scope);
    const stock = await this.requireAvailableStock(input, jumlah);
    const result = await this.repository.removeStock({
      barangId: input.barangId,
      gudangId: input.gudangId,
      jumlah,
      kondisi: input.kondisi || DEFAULT_KONDISI_BARANG,
      keterangan: input.keterangan,
      tujuanPenggunaan: input.tujuanPenggunaan,
      fotoBukti: input.fotoBukti || [],
      fotoMetadata: input.fotoMetadata || null,
      actor: scope.actor,
      tenantId: input.tenantId,
      tanggal: new Date(),
    });
    const totalStok = await this.repository.getStockLevel(
      input.barangId,
      input.gudangId,
    );
    await this.emitBarangKeluarSideEffects(
      input,
      scope.actor,
      jumlah,
      totalStok,
      stock,
    );

    return result;
  }

  /** Mengambil riwayat transaksi inventory mobile sesuai scope actor. */
  async getRiwayat(input: {
    actorId: string;
    tenantId: string;
    type?: string | null;
    cursor?: string | null;
  }) {
    const scope = await this.requireActorScope(input);
    this.ensureAssignedSite(scope);
    const where = this.buildHistoryWhere(input, scope);
    const transactions = await this.loadHistoryTransactions(input, where);

    return this.paginateHistory(transactions);
  }

  private async requireActorScope(input: MobileActorLookupInput) {
    const user = await this.repository.findMobileActorUser(input);
    const mitra = user
      ? null
      : await this.repository.findMobileActorMitra(input.actorId);
    const scope = resolveInventoryActorScope({
      user,
      mitra,
      isSuperAdmin: user ? isSuperAdmin({ role: user.role?.name }) : false,
    });

    if (!scope) {
      throw new MobileInventoryError("User tidak ditemukan", 404);
    }

    return scope;
  }

  private ensureAssignedSite(scope: {
    isRestricted: boolean;
    allowedSiteIds: string[];
  }) {
    if (scope.isRestricted && scope.allowedSiteIds.length === 0) {
      throw new MobileInventoryError(
        "Akses ditolak: Tidak ada site yang ditugaskan",
        403,
      );
    }
  }

  private getScopedSiteIds(scope: {
    isRestricted: boolean;
    allowedSiteIds: string[];
  }) {
    return scope.isRestricted ? scope.allowedSiteIds : undefined;
  }

  private parseJumlah(jumlah: unknown) {
    const parsedJumlah = Number(jumlah);

    if (!Number.isFinite(parsedJumlah) || parsedJumlah <= 0) {
      throw new MobileInventoryError("Data tidak lengkap", 400);
    }

    return parsedJumlah;
  }

  private async ensureGudangAccess(
    input: MobileGudangLookupInput,
    scope: { isRestricted: boolean; allowedSiteIds: string[] },
  ) {
    const gudang = await this.repository.findMobileGudangSites(input);

    if (!gudang) {
      throw new MobileInventoryError("Gudang tidak ditemukan", 404);
    }

    const access = validateInventoryGudangAccess({
      isRestricted: scope.isRestricted,
      allowedSiteIds: scope.allowedSiteIds,
      gudangSiteIds: gudang.sites.map((site) => site.id),
    });

    if (!access.allowed) {
      throw new MobileInventoryError(access.error || "Akses ditolak", 403);
    }
  }

  private async requireAvailableStock(
    input: MobileCommandInput,
    jumlah: number,
  ) {
    const stock = await this.repository.findMobileBarangGudangStock(input);
    const kondisi = input.kondisi || DEFAULT_KONDISI_BARANG;
    const availableStock = stock ? this.getStockByKondisi(stock, kondisi) : 0;

    if (!stock || availableStock < jumlah) {
      throw new MobileInventoryError(
        `Stok ${kondisi} tidak mencukupi. Tersedia: ${availableStock}`,
        400,
      );
    }

    return stock;
  }

  private getStockByKondisi(
    stock: MobileBarangGudangStock,
    kondisi: KondisiBarang,
  ) {
    if (kondisi === "BEKAS") return stock.stokBekas || 0;
    if (kondisi === "RUSAK") return stock.stokRusak || 0;
    return stock.stokBaru || 0;
  }

  private async emitBarangKeluarSideEffects(
    input: MobileCommandInput,
    actor: InventoryActorInput,
    jumlah: number,
    totalStok: number,
    stock: MobileBarangGudangStock,
  ) {
    socketEmitter.inventoryUpdate({
      type: "keluar",
      userId: actor.id,
      barangId: input.barangId,
      gudangId: input.gudangId,
      jumlah,
      totalStok,
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Inventory Out (Mobile)",
      details: this.buildBarangKeluarLogDetails(input, jumlah, stock),
      actor,
      tenantId: input.tenantId,
    });
  }

  private buildBarangKeluarLogDetails(
    input: MobileCommandInput,
    jumlah: number,
    stock: MobileBarangGudangStock,
  ) {
    return {
      barangId: input.barangId,
      namaBarang: stock.barang?.nama,
      jumlah,
      kondisi: input.kondisi,
      gudangId: input.gudangId,
      keterangan: input.keterangan,
      tujuanPenggunaan: input.tujuanPenggunaan,
    };
  }

  private buildHistoryWhere(
    input: { tenantId: string; cursor?: string | null },
    scope: {
      actor: InventoryActorInput;
      isRestricted: boolean;
      allowedSiteIds: string[];
    },
  ) {
    const where: Record<string, unknown> = {
      tenantId: input.tenantId,
      ...buildInventoryActorFilter(scope.actor),
    };

    if (scope.isRestricted) {
      where.gudang = { sites: { some: { id: { in: scope.allowedSiteIds } } } };
    }

    if (input.cursor) {
      where.tanggal = { lt: new Date(input.cursor) };
    }

    return where;
  }

  private async loadHistoryTransactions(
    input: { tenantId: string; type?: string | null },
    where: Record<string, unknown>,
  ) {
    if (input.type === "masuk")
      return this.mapHistory(
        "masuk",
        await this.repository.findMobileHistoryMasuk({
          tenantId: input.tenantId,
          where,
          take: DEFAULT_HISTORY_LIMIT + 1,
        }),
      );
    if (input.type === "keluar")
      return this.mapHistory(
        "keluar",
        await this.repository.findMobileHistoryKeluar({
          tenantId: input.tenantId,
          where,
          take: DEFAULT_HISTORY_LIMIT + 1,
        }),
      );

    const [masuk, keluar] = await Promise.all([
      this.repository.findMobileHistoryMasuk({
        tenantId: input.tenantId,
        where,
        take: DEFAULT_HISTORY_LIMIT,
      }),
      this.repository.findMobileHistoryKeluar({
        tenantId: input.tenantId,
        where,
        take: DEFAULT_HISTORY_LIMIT,
      }),
    ]);

    return [
      ...this.mapHistory("masuk", masuk),
      ...this.mapHistory("keluar", keluar),
    ].sort(
      (left, right) =>
        (right.rawDate?.getTime() || 0) - (left.rawDate?.getTime() || 0),
    );
  }

  private mapHistory(
    type: "masuk" | "keluar",
    records: MobileHistoryRecord[],
  ): MobileHistoryItem[] {
    return records.map((record) => ({
      id: record.id,
      type,
      barang: record.barang,
      gudang: record.gudang,
      jumlah: record.jumlah,
      kondisi: record.kondisi,
      keterangan: record.keterangan,
      tanggal: record.tanggal.toISOString(),
      rawDate: record.tanggal,
    }));
  }

  private paginateHistory(transactions: MobileHistoryItem[]) {
    let nextCursor: string | null = null;
    let data = transactions;

    if (data.length > DEFAULT_HISTORY_LIMIT) {
      nextCursor = String(data[DEFAULT_HISTORY_LIMIT - 1].tanggal);
      data = data.slice(0, DEFAULT_HISTORY_LIMIT);
    } else if (data.length === DEFAULT_HISTORY_LIMIT) {
      nextCursor = String(data[data.length - 1].tanggal);
    }

    return {
      data: data.map(({ rawDate: _rawDate, ...item }) => item),
      nextCursor,
    };
  }

  private mapBarangMaster(items: MobileBarangMaster[]) {
    return items.map((item) => ({
      ...item,
      stok: 0,
      stokBaru: 0,
      stokBekas: 0,
      stokRusak: 0,
    }));
  }

  private mapBarangStock(items: MobileBarangStock[]) {
    return items.map((item) => ({
      id: item.barang.id,
      kode: item.barang.kode,
      nama: item.barang.nama,
      satuan: item.barang.satuan,
      isWorkOrderMaterial: item.barang.isWorkOrderMaterial,
      stok: item.stok,
      stokBaru: item.stokBaru,
      stokBekas: item.stokBekas,
      stokRusak: item.stokRusak,
    }));
  }
}
