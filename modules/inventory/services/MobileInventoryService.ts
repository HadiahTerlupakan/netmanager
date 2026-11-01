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
  validateMobileCommandTarget,
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
      throw new MobileInventoryError(
        "Gudang belum dipilih. Pilih gudangnya dulu, nanti daftar barangnya muncul.",
        400,
      );
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
    validateMobileCommandTarget(input);
    const jumlah = parseMobileJumlah(input.jumlah);
    const scope = await requireMobileActorScope(this.repository, input);
    await ensureMobileGudangAccess(this.repository, input, scope);
    const result = await forwardStockRejection(() =>
      this.repository.addStock({
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
      }),
    );

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
    validateMobileCommandTarget(input);
    const jumlah = parseMobileJumlah(input.jumlah);
    const scope = await requireMobileActorScope(this.repository, input);
    await ensureMobileGudangAccess(this.repository, input, scope);
    const stock = await requireMobileAvailableStock(
      this.repository,
      input,
      jumlah,
    );
    const result = await forwardStockRejection(() =>
      this.repository.removeStock({
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
      }),
    );
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

/**
 * Teruskan penolakan aturan stok dari repository ke pengguna mobile.
 *
 * Penulisan stok melempar `Error` biasa berisi kalimat untuk pengguna (mis.
 * stok berkurang di antara pengecekan dan penyimpanan). Tanpa ini, kalimat itu
 * tertelan menjadi "gangguan server" 500 dan antrean offline mengulanginya
 * terus. Galat lain (Prisma, jaringan DB) adalah subclass dan tetap menjadi
 * 500 yang dicatat di log.
 */
async function forwardStockRejection<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error: unknown) {
    const isAturanStok =
      error instanceof Error &&
      error.constructor === Error &&
      !error.message.startsWith("SECURITY_BREACH");
    if (isAturanStok) throw new MobileInventoryError(error.message, 400);
    throw error;
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
