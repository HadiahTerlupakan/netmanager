import { PrismaClient } from "@prisma/client";
import type {
  CreateTransferInput,
  InventoryTransferRecord,
  UpdateTransferInput,
} from "../domain/ports/IInventoryOperationRepository";
import {
  createTransfer,
  deleteTransfer,
  findAllTransfers,
  findTransferById,
  updateTransfer,
} from "./inventory-repository-transfer-helpers";

export class InventoryTransferRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Ambil daftar transfer antar gudang. */
  async findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: InventoryTransferRecord[]; total: number }> {
    return findAllTransfers(this.db, params);
  }

  /** Ambil detail transfer antar gudang. */
  async findTransferById(id: string): Promise<InventoryTransferRecord | null> {
    return findTransferById(this.db, id);
  }

  /** Buat transfer antar gudang. */
  async createTransfer(
    data: CreateTransferInput,
  ): Promise<InventoryTransferRecord> {
    return createTransfer(this.db, data);
  }

  /** Ubah keterangan transfer antar gudang. */
  async updateTransfer(
    id: string,
    data: UpdateTransferInput,
  ): Promise<InventoryTransferRecord> {
    return updateTransfer(this.db, id, data);
  }

  /** Hapus transfer antar gudang. */
  async deleteTransfer(id: string): Promise<void> {
    await deleteTransfer(this.db, id);
  }
}
