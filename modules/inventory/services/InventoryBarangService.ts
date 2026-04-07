import { logger } from "@/lib/logger";
import { InventoryRepository } from "../repositories/InventoryRepository";

interface ListBarangInput {
  userId: string;
  search?: string | null;
  gudangId?: string | null;
  page: number;
  limit: number;
  siteId?: string;
}

interface CreateBarangInput {
  userId: string;
  kode?: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial?: boolean;
  jenis?: string;
  kategoriAset?: string;
  minStokDefault?: number;
}

export class InventoryBarangService {
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
  }

  async listBarang(input: ListBarangInput) {
    const offset = (input.page - 1) * input.limit;
    const { items: barangs, total } =
      await this.inventoryRepository.findAllBarang({
        skip: offset,
        take: input.limit,
        ...(input.search ? { search: input.search } : {}),
        ...(input.gudangId ? { gudangId: input.gudangId } : {}),
        ...(input.siteId ? { siteId: input.siteId } : {}),
      });

    const barangsWithStock = barangs.map((barang) => {
      let totalStock = 0;
      let stockPerGudang: {
        gudangId: string;
        gudangKode: string;
        gudangNama: string;
        stok: number;
        stokBaru: number;
        stokBekas: number;
        stokRusak: number;
      }[] = [];

      if (barang.barangGudang) {
        const filteredStocks = input.gudangId
          ? barang.barangGudang.filter(
              (stock) => stock.gudangId === input.gudangId,
            )
          : barang.barangGudang;

        totalStock = filteredStocks.reduce((sum, stock) => sum + stock.stok, 0);

        stockPerGudang = filteredStocks.map((stock) => ({
          gudangId: stock.gudangId,
          gudangKode: stock.gudang.kode,
          gudangNama: stock.gudang.nama,
          stok: stock.stok,
          stokBaru: (stock as unknown as Record<string, number>).stokBaru || 0,
          stokBekas:
            (stock as unknown as Record<string, number>).stokBekas || 0,
          stokRusak:
            (stock as unknown as Record<string, number>).stokRusak || 0,
        }));
      }

      return {
        id: barang.id,
        kode: barang.kode,
        nama: barang.nama,
        satuan: barang.satuan,
        isWorkOrderMaterial: barang.isWorkOrderMaterial,
        jenis: barang.jenis,
        kategoriAset: barang.kategoriAset,
        minStokDefault: barang.minStokDefault || 0,
        createdAt: barang.createdAt,
        updatedAt: barang.updatedAt,
        totalStock,
        stockPerGudang,
      };
    });

    return {
      barangs: barangsWithStock,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async createBarang(input: CreateBarangInput) {
    let kode = input.kode?.trim();

    if (kode) {
      const isExists = await this.inventoryRepository.existsBarangByKode(kode);
      if (isExists) {
        throw new Error(
          `Kode barang "${kode}" sudah digunakan. Silakan gunakan kode lain atau kosongkan field kode.`,
        );
      }
    } else {
      let attempts = 0;
      const maxAttempts = 10;

      do {
        kode = this.generateBarangCode();
        const isExists =
          await this.inventoryRepository.existsBarangByKode(kode);

        if (!isExists) break;
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        throw new Error("Gagal generate kode unik");
      }
    }

    const barang = await this.inventoryRepository.createBarang({
      kode,
      nama: input.nama,
      satuan: input.satuan,
      isWorkOrderMaterial: input.isWorkOrderMaterial,
      jenis: input.jenis as never,
      kategoriAset: input.kategoriAset as never,
      minStokDefault: input.minStokDefault,
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Barang",
      userId: input.userId,
      details: { id: barang.id, nama: barang.nama, kode: barang.kode },
    });

    return { barang };
  }

  private generateBarangCode(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `BRG${timestamp.toString().slice(-6)}${random.toString().padStart(3, "0")}`;
  }
}

let inventoryBarangServiceInstance: InventoryBarangService | null = null;

export function getInventoryBarangService(): InventoryBarangService {
  if (!inventoryBarangServiceInstance) {
    inventoryBarangServiceInstance = new InventoryBarangService();
  }

  return inventoryBarangServiceInstance;
}
