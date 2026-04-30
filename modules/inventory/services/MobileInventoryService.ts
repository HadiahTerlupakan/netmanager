import { socketEmitter } from "@/lib/websocket/emitter";
import { InventoryRepository } from "../repositories/InventoryRepository";
import {
  ensureMobileAssignedSite,
  ensureMobileGudangAccess,
  emitMobileBarangKeluarSideEffects,
  getMobileScopedSiteIds,
  loadMobileHistoryTransactions,
  mapMobileBarangMaster,
  mapMobileBarangStock,
  paginateMobileHistory,
  parseMobileJumlah,
  requireMobileActorScope,
  requireMobileAvailableStock,
  buildMobileHistoryWhere,
} from "./mobile-inventory.service-helpers";
import {
  MobileInventoryError,
  type MobileActorLookupInput,
  type MobileCommandInput,
  type MobileGudangItem,
  type MobileInventoryRepository,
} from "./mobile-inventory.types";

const DEFAULT_KONDISI_BARANG = "BARU" as const;

export class MobileInventoryService {
  constructor(
    private readonly repository: MobileInventoryRepository = new InventoryRepository(),
  ) {}

  /** Mengambil daftar gudang mobile sesuai scope site actor. */
  async getGudangs(input: MobileActorLookupInput): Promise<MobileGudangItem[]> {
    const scope = await requireMobileActorScope(this.repository, input);
    ensureMobileAssignedSite(scope);

    return this.repository.findMobileGudangs({
      tenantId: input.tenantId,
      siteIds: getMobileScopedSiteIds(scope),
    });
  }

  /** Mengambil daftar barang mobile untuk mode masuk atau keluar. */
  async getBarang(input: {
    actorId: string;
    tenantId: string;
    gudangId?: string | null;
    mode: string;
  }) {
    const scope = await requireMobileActorScope(this.repository, input);
    ensureMobileAssignedSite(scope);

    if (input.mode === "masuk") {
      return mapMobileBarangMaster(
        await this.repository.findMobileBarangForMasuk({
          tenantId: input.tenantId,
          siteIds: getMobileScopedSiteIds(scope),
        }),
      );
    }

    if (!input.gudangId) {
      throw new MobileInventoryError("gudangId required", 400);
    }

    return mapMobileBarangStock(
      await this.repository.findMobileBarangForKeluar({
        tenantId: input.tenantId,
        gudangId: input.gudangId,
        siteIds: getMobileScopedSiteIds(scope),
      }),
    );
  }

  /** Mencatat barang masuk mobile setelah validasi scope gudang. */
  async createBarangMasuk(input: MobileCommandInput) {
    const jumlah = parseMobileJumlah(input.jumlah);
    const scope = await requireMobileActorScope(this.repository, input);
    await ensureMobileGudangAccess(this.repository, input, scope);
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
    const jumlah = parseMobileJumlah(input.jumlah);
    const scope = await requireMobileActorScope(this.repository, input);
    await ensureMobileGudangAccess(this.repository, input, scope);
    const stock = await requireMobileAvailableStock(
      this.repository,
      input,
      jumlah,
    );
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
    await emitMobileBarangKeluarSideEffects({
      command: input,
      actor: scope.actor,
      jumlah,
      totalStok,
      stock,
    });

    return result;
  }

  /** Mengambil riwayat transaksi inventory mobile sesuai scope actor. */
  async getRiwayat(input: {
    actorId: string;
    tenantId: string;
    type?: string | null;
    cursor?: string | null;
  }) {
    const scope = await requireMobileActorScope(this.repository, input);
    ensureMobileAssignedSite(scope);
    const where = buildMobileHistoryWhere(input, scope);
    const transactions = await loadMobileHistoryTransactions(
      this.repository,
      input,
      where,
    );

    return paginateMobileHistory(transactions);
  }
}

let mobileInventoryServiceInstance: MobileInventoryService | null = null;

/** Ambil singleton service inventory mobile. */
export function getMobileInventoryService() {
  if (!mobileInventoryServiceInstance) {
    mobileInventoryServiceInstance = new MobileInventoryService();
  }

  return mobileInventoryServiceInstance;
}
