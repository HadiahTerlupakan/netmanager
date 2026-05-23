import type {
  InventoryMasukRecord,
  UpdateBarangMasukInput,
} from "../domain/ports/IInventoryOperationRepository";
import { InventoryRepository } from "../repositories/InventoryRepository";

interface InventoryStockMovementRepository {
  getMasukRecord(id: string): Promise<InventoryMasukRecord | null>;
  updateMasuk(input: UpdateBarangMasukInput): Promise<void>;
  deleteMasuk(id: string): Promise<void>;
}

export class InventoryStockMovementService {
  constructor(
    private readonly inventoryRepository: InventoryStockMovementRepository = new InventoryRepository(),
  ) {}

  /** Mengambil detail record barang masuk beserta relasinya. */
  async getMasukRecord(id: string) {
    return this.inventoryRepository.getMasukRecord(id);
  }

  /** Memperbarui record barang masuk dan menyesuaikan stok gudang terkait. */
  async updateMasuk(input: UpdateBarangMasukInput) {
    await this.inventoryRepository.updateMasuk(input);
  }

  /** Menghapus record barang masuk dan merekonsiliasi stok gudang. */
  async deleteMasuk(id: string) {
    await this.inventoryRepository.deleteMasuk(id);
  }
}

let inventoryStockMovementServiceInstance: InventoryStockMovementService | null =
  null;

export function getInventoryStockMovementService() {
  if (!inventoryStockMovementServiceInstance) {
    inventoryStockMovementServiceInstance = new InventoryStockMovementService();
  }

  return inventoryStockMovementServiceInstance;
}
