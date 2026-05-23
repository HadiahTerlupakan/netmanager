import { PurchaseOrderRepository } from "../repositories/PurchaseOrderRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import type { PurchaseOrderEntity } from "../domain/entities/PurchaseOrder";
import type {
  IPurchaseOrderRepository,
  PurchaseOrderListFilter,
  PurchaseOrderListResult,
  PurchaseOrderMetadataUpdate,
  PurchaseOrderWithRelations,
} from "../domain/ports/IPurchaseOrderRepository";
import type { ISupplierRepository } from "../domain/ports/ISupplierRepository";
import type { CreatePurchaseOrderInput } from "../validators/purchase-order";

export class PurchaseOrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Purchase Order ${id} tidak ditemukan`);
    this.name = "PurchaseOrderNotFoundError";
  }
}

export class PurchaseOrderNotEditableError extends Error {
  constructor(message = "Purchase Order tidak dapat diubah pada status ini") {
    super(message);
    this.name = "PurchaseOrderNotEditableError";
  }
}

interface CreatePurchaseOrderServiceInput extends CreatePurchaseOrderInput {
  createdBy: string;
  tenantId: string | null;
}

/**
 * Service Purchase Order: CRUD + integrasi vendor master.
 *
 * Saat create, kalau supplier dipilih dan `vendorNpwp` tidak di-supply,
 * NPWP otomatis dipopulasi dari `Supplier.npwp` agar PO punya snapshot
 * vendor yang konsisten saat pembayaran nanti.
 */
export class PurchaseOrderService {
  constructor(
    private readonly poRepo: IPurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly supplierRepo: ISupplierRepository = new SupplierRepository(),
  ) {}

  list(filter: PurchaseOrderListFilter): Promise<PurchaseOrderListResult> {
    return this.poRepo.list(filter);
  }

  async getById(id: string): Promise<PurchaseOrderWithRelations> {
    const po = await this.poRepo.findByIdWithRelations(id);
    if (!po) throw new PurchaseOrderNotFoundError(id);
    return po;
  }

  async create(
    input: CreatePurchaseOrderServiceInput,
  ): Promise<PurchaseOrderEntity> {
    const vendorNpwp = await this.resolveVendorNpwp(
      input.supplierId ?? null,
      input.vendorNpwp ?? null,
    );

    const poNumber = await this.poRepo.generatePoNumber(input.tenantId);

    return this.poRepo.create({
      poNumber,
      supplierId: input.supplierId ?? null,
      createdBy: input.createdBy,
      tenantId: input.tenantId,
      expectedDate: input.expectedDate ?? null,
      notes: input.notes ?? null,
      ppnRate: input.ppnRate ?? 0,
      vendorNpwp,
      items: input.items,
    });
  }

  async update(
    id: string,
    data: PurchaseOrderMetadataUpdate,
  ): Promise<PurchaseOrderEntity> {
    const existing = await this.poRepo.findById(id);
    if (!existing) throw new PurchaseOrderNotFoundError(id);
    if (existing.paymentStatus === "PAID") {
      throw new PurchaseOrderNotEditableError(
        "Purchase Order sudah lunas dan tidak dapat diubah",
      );
    }
    return this.poRepo.updateMetadata(id, data);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.poRepo.findById(id);
    if (!existing) throw new PurchaseOrderNotFoundError(id);
    if (existing.paymentStatus !== "UNPAID") {
      throw new PurchaseOrderNotEditableError(
        "Purchase Order yang sudah dibayar (sebagian/penuh) tidak dapat dihapus",
      );
    }
    await this.poRepo.delete(id);
  }

  private async resolveVendorNpwp(
    supplierId: string | null,
    overrideNpwp: string | null,
  ): Promise<string | null> {
    if (overrideNpwp) return overrideNpwp;
    if (!supplierId) return null;
    const supplier = await this.supplierRepo.findById(supplierId);
    return supplier?.npwp ?? null;
  }
}
