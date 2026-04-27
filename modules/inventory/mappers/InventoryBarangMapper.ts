import type { Barang } from "@prisma/client";
import type {
  InventoryBarangEntity,
  InventoryStockEntity,
} from "../domain/entities/InventoryEntity";

interface PrismaBarangStockRecord {
  id: string;
  gudangId: string;
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  gudang?: {
    id: string;
    kode: string;
    nama: string;
  };
}

interface PrismaBarangWithStock extends Barang {
  barangGudang?: PrismaBarangStockRecord[];
}

export class InventoryBarangMapper {
  /** Map Prisma barang stock relation into domain stock entity. */
  private static toStockEntity(
    stock: PrismaBarangStockRecord,
  ): InventoryStockEntity {
    if (!stock.gudang) {
      throw new Error("Relasi gudang wajib ada saat barangGudang di-load");
    }

    return {
      id: stock.id,
      gudangId: stock.gudangId,
      stok: stock.stok,
      stokBaru: stock.stokBaru,
      stokBekas: stock.stokBekas,
      stokRusak: stock.stokRusak,
      gudang: stock.gudang,
    };
  }

  /** Map Prisma barang with optional stock relations into domain entity. */
  static toDomain(model: PrismaBarangWithStock): InventoryBarangEntity {
    return {
      id: model.id,
      kode: model.kode,
      nama: model.nama,
      satuan: model.satuan,
      isWorkOrderMaterial: model.isWorkOrderMaterial,
      jenis: model.jenis,
      kategoriAset: model.kategoriAset,
      minStokDefault: model.minStokDefault ?? 0,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      barangGudang: (model.barangGudang ?? []).map((stock) =>
        this.toStockEntity(stock),
      ),
    };
  }
}
