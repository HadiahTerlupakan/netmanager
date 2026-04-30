import { logger } from "@/lib/logger";
import type { IInventoryRepository } from "../domain/ports/IInventoryRepository";
import { InventoryRepository } from "../repositories/InventoryRepository";
import {
  mapBarangListItem,
  resolveUniqueBarangCode,
} from "./inventory-barang.service-helpers";

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
  private inventoryRepository: IInventoryRepository;

  constructor(
    inventoryRepository: IInventoryRepository = new InventoryRepository(),
  ) {
    this.inventoryRepository = inventoryRepository;
  }

  /** Get paginated barang data with stock summaries. */
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

    const barangsWithStock = barangs.map((barang) =>
      mapBarangListItem({ barang, gudangId: input.gudangId }),
    );

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

  /** Create a barang with unique code generation and activity log. */
  async createBarang(input: CreateBarangInput) {
    const kode = await resolveUniqueBarangCode(
      this.inventoryRepository,
      input.kode,
    );

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
}

let inventoryBarangServiceInstance: InventoryBarangService | null = null;

export function getInventoryBarangService(): InventoryBarangService {
  if (!inventoryBarangServiceInstance) {
    inventoryBarangServiceInstance = new InventoryBarangService();
  }

  return inventoryBarangServiceInstance;
}
