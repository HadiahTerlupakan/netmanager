import { PurchaseOrderRepository } from "../repositories/PurchaseOrderRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { ApprovalThresholdRepository } from "../repositories/ApprovalThresholdRepository";
import type { PurchaseOrderEntity } from "../domain/entities/PurchaseOrder";
import type {
  IPurchaseOrderRepository,
  PurchaseOrderListFilter,
  PurchaseOrderListResult,
  PurchaseOrderDetail,
  PurchaseOrderMetadataUpdate,
} from "../domain/ports/IPurchaseOrderRepository";
import type { ISupplierRepository } from "../domain/ports/ISupplierRepository";
import type { IApprovalThresholdRepository } from "../domain/ports/IApprovalThresholdRepository";
import type { CreatePurchaseOrderInput } from "../validators/purchase-order";
import { SupplierNotActiveError } from "./SupplierService";
import { ApprovalThresholdService } from "./ApprovalThresholdService";

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

/**
 * PO milik pengajuan restock tidak boleh diproses dari halaman pembelian:
 * sudah dibeli atau belum hanya dicatat lewat link belanja di halaman restock.
 */
export class PurchaseOrderIsRestockError extends PurchaseOrderNotEditableError {
  constructor() {
    super(
      "Pesanan ini dibuat dari pengajuan restock. Sudah dibeli atau belum dicatat lewat link belanja di halaman restock, jadi tidak bisa diproses dari sini.",
    );
    this.name = "PurchaseOrderIsRestockError";
  }
}

/** PO tidak bisa dihapus karena belanjanya sudah dicatat. */
export class PurchaseOrderHasPurchasesError extends PurchaseOrderNotEditableError {
  constructor() {
    super(
      "Pesanan ini sudah punya catatan belanja, jadi tidak bisa dihapus. Batalkan lewat halaman restock bila barangnya tidak jadi datang.",
    );
    this.name = "PurchaseOrderHasPurchasesError";
  }
}

interface CreatePurchaseOrderServiceInput extends CreatePurchaseOrderInput {
  createdBy: string;
  tenantId: string | null;
  /**
   * Daftar roleId milik user yang membuat PO. Dipakai guard
   * `ApprovalThresholdService.assertCanApprove` untuk gating create PO
   * ke nominal yang melebihi wewenang. Kalau tenant belum config threshold
   * apa pun, guard ini no-op (backward compat).
   */
  creatorRoleIds?: string[];
}

/**
 * Service Purchase Order: CRUD + snapshot data Supplier.
 *
 * Catatan istilah: di project ini "vendor" === "supplier".
 * Field DB `PurchaseOrder.vendorNpwp` adalah snapshot NPWP dari
 * `Supplier.npwp` saat PO dibuat — disnapshot supaya posisi pajak
 * tidak berubah jika master Supplier diedit setelah PO issued.
 */
export class PurchaseOrderService {
  private readonly approvalThresholdService: ApprovalThresholdService;

  constructor(
    private readonly poRepo: IPurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly supplierRepo: ISupplierRepository = new SupplierRepository(),
    approvalThresholdRepo: IApprovalThresholdRepository = new ApprovalThresholdRepository(),
  ) {
    this.approvalThresholdService = new ApprovalThresholdService(
      approvalThresholdRepo,
    );
  }

  list(filter: PurchaseOrderListFilter): Promise<PurchaseOrderListResult> {
    return this.poRepo.list(filter);
  }

  /** Detail PO beserta penanda apakah PO ini milik pengajuan restock. */
  async getById(id: string): Promise<PurchaseOrderDetail> {
    const po = await this.poRepo.findByIdWithRelations(id);
    if (!po) throw new PurchaseOrderNotFoundError(id);
    const restockRequestCount =
      await this.poRepo.countLinkedRestockRequests(id);
    return { ...po, isRestockOrder: restockRequestCount > 0 };
  }

  async create(
    input: CreatePurchaseOrderServiceInput,
  ): Promise<PurchaseOrderEntity> {
    const vendorNpwp = await this.resolveVendorNpwp(
      input.supplierId ?? null,
      input.vendorNpwp ?? null,
    );

    const subtotal = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unitPrice,
      0,
    );
    const ppnAmount = subtotal * ((input.ppnRate ?? 0) / 100);
    const grandTotalEstimate = subtotal + ppnAmount;

    if (input.creatorRoleIds && input.creatorRoleIds.length > 0) {
      await this.approvalThresholdService.assertCanApprove({
        tenantId: input.tenantId,
        scope: "PURCHASE_ORDER",
        amount: grandTotalEstimate,
        roleIds: input.creatorRoleIds,
      });
    }

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

    let vendorNpwp = data.vendorNpwp;
    if (data.supplierId !== undefined) {
      vendorNpwp = await this.resolveVendorNpwp(
        data.supplierId,
        data.vendorNpwp ?? null,
      );
    }

    return this.poRepo.updateMetadata(id, { ...data, vendorNpwp });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.poRepo.findById(id);
    if (!existing) throw new PurchaseOrderNotFoundError(id);
    if (existing.status === "RECEIVED") {
      throw new PurchaseOrderNotEditableError(
        "Purchase Order yang sudah diterima (RECEIVED) tidak dapat dihapus",
      );
    }
    const outcome = await this.poRepo.delete(id);
    if (outcome === "HAS_PURCHASES") throw new PurchaseOrderHasPurchasesError();
  }

  /** DRAFT → ORDERED untuk PO biasa; PO restock ditolak. */
  async process(id: string, actorId: string): Promise<PurchaseOrderEntity> {
    const existing = await this.poRepo.findById(id);
    if (!existing) throw new PurchaseOrderNotFoundError(id);
    if (existing.status !== "DRAFT") {
      throw new PurchaseOrderNotEditableError(
        "Hanya PO Draft yang bisa diproses menjadi Ordered",
      );
    }
    if ((await this.poRepo.countLinkedRestockRequests(id)) > 0) {
      throw new PurchaseOrderIsRestockError();
    }
    return this.poRepo.processToOrdered(id, actorId);
  }

  /**
   * Cari NPWP vendor untuk disnapshot ke PO.
   * Sekaligus validasi supplier wajib ACTIVE saat PO dibuat — INACTIVE/BLACKLISTED
   * dilarang supaya tidak ada commitment baru ke vendor bermasalah.
   */
  private async resolveVendorNpwp(
    supplierId: string | null,
    overrideNpwp: string | null,
  ): Promise<string | null> {
    if (!supplierId) return overrideNpwp;
    const supplier = await this.supplierRepo.findById(supplierId);
    if (!supplier) return overrideNpwp;
    if (supplier.status !== "ACTIVE") {
      throw new SupplierNotActiveError(
        supplier.id,
        supplier.status,
        supplier.blacklistReason,
      );
    }
    return overrideNpwp ?? supplier.npwp ?? null;
  }
}
