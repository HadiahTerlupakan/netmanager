export type {
  PurchaseOrderDTO,
  PurchaseOrderItemDTO,
} from "./dto/ProcurementDTO";
export { toPurchaseRequestSummaryDTO } from "./dto/PurchaseRequestDTO";
export type {
  PurchaseRequestSummaryDTO,
  PurchaseRequestListResponseDTO,
} from "./dto/PurchaseRequestDTO";
export * from "./services/ProcurementService";

// Purchase Order — fully owned by procurement now (sebelumnya di finance).
import { PurchaseOrderRepository } from "./repositories/PurchaseOrderRepository";
import { PurchaseOrderPaymentService } from "./services/PurchaseOrderPaymentService";
import { PurchaseOrderService } from "./services/PurchaseOrderService";
import { ProcurementService } from "./services/ProcurementService";
import { SupplierRepository } from "./repositories/SupplierRepository";
import { SupplierService } from "./services/SupplierService";

export function getPurchaseOrderRepository(): PurchaseOrderRepository {
  return new PurchaseOrderRepository();
}

export function getPurchaseOrderPaymentService(): PurchaseOrderPaymentService {
  return new PurchaseOrderPaymentService(new PurchaseOrderRepository());
}

export function getPurchaseOrderService(): PurchaseOrderService {
  return new PurchaseOrderService(
    new PurchaseOrderRepository(),
    new SupplierRepository(),
  );
}

export { PurchaseOrderPaymentService } from "./services/PurchaseOrderPaymentService";
export {
  PurchaseOrderService,
  PurchaseOrderNotFoundError,
  PurchaseOrderNotEditableError,
} from "./services/PurchaseOrderService";

export type {
  IPurchaseOrderRepository,
  PurchaseOrderPaymentInput,
  PurchaseOrderPaymentResult,
  PurchaseOrderListFilter,
  PurchaseOrderListResult,
  PurchaseOrderCreateInput,
  PurchaseOrderMetadataUpdate,
  PurchaseOrderWithRelations,
  PurchaseOrderWithSupplier,
} from "./domain/ports/IPurchaseOrderRepository";
export type { PayPurchaseOrderInput } from "./services/PurchaseOrderPaymentService";
export type {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
} from "./domain/entities/PurchaseOrder";

export {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderListQuerySchema,
} from "./validators/purchase-order";
export type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderListQuery,
} from "./validators/purchase-order";

export {
  purchaseRequestListQuerySchema,
  generatePOFromPRSchema,
} from "./validators/purchase-request";
export type {
  PurchaseRequestListQuery,
  GeneratePOFromPRInput,
} from "./validators/purchase-request";

export type { PurchaseRequestSummaryEntity } from "./domain/entities/PurchaseRequest";
export type {
  PurchaseRequestListFilter,
  PurchaseRequestListResult,
} from "./domain/ports/IProcurementRepository";

export function getProcurementService(): ProcurementService {
  return new ProcurementService();
}

// Supplier sub-module — master pihak ketiga (alias: "vendor") untuk PO/Expense.
// Memuat NPWP & defaultPphCategory yang dipakai modul tax saat PO dibayar.
export function getSupplierService(): SupplierService {
  return new SupplierService(new SupplierRepository());
}

export {
  SupplierService,
  SupplierCodeAlreadyExistsError,
  SupplierNotFoundError,
  SupplierNotActiveError,
} from "./services/SupplierService";

export type {
  Supplier,
  SupplierPphCategory,
  SupplierStatus,
} from "./domain/entities/Supplier";
export {
  SUPPLIER_PPH_CATEGORIES,
  SUPPLIER_STATUSES,
} from "./domain/entities/Supplier";

export type {
  ISupplierRepository,
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierListFilter,
  SupplierListResult,
} from "./domain/ports/ISupplierRepository";

export { toSupplierDTO } from "./dto/SupplierDTO";
export type { SupplierDTO, SupplierListResponseDTO } from "./dto/SupplierDTO";

export {
  createSupplierSchema,
  updateSupplierSchema,
  supplierListQuerySchema,
} from "./validators/supplier";
export type {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierListQuery,
} from "./validators/supplier";

// Goods Receipt Note (GRN) — dokumen penerimaan barang per batch.
import { GoodsReceiptRepository } from "./repositories/GoodsReceiptRepository";
import { GoodsReceiptService } from "./services/GoodsReceiptService";

export function getGoodsReceiptService(): GoodsReceiptService {
  return new GoodsReceiptService(
    new GoodsReceiptRepository(),
    new PurchaseOrderRepository(),
  );
}

export {
  GoodsReceiptService,
  GoodsReceiptNotFoundError,
  GoodsReceiptInvalidError,
} from "./services/GoodsReceiptService";

export type {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
  GoodsReceiptStatus,
} from "./domain/entities/GoodsReceipt";
export { GOODS_RECEIPT_STATUSES } from "./domain/entities/GoodsReceipt";

export type {
  IGoodsReceiptRepository,
  GoodsReceiptCreateInput,
  GoodsReceiptListFilter,
  GoodsReceiptListResult,
  GoodsReceiptListSummary,
  GoodsReceiptWithRelations,
  GoodsReceiptItemCreateInput,
} from "./domain/ports/IGoodsReceiptRepository";

export {
  toGoodsReceiptDTO,
  toGoodsReceiptListItemDTO,
} from "./dto/GoodsReceiptDTO";
export type {
  GoodsReceiptDTO,
  GoodsReceiptItemDTO,
  GoodsReceiptListItemDTO,
  GoodsReceiptListResponseDTO,
} from "./dto/GoodsReceiptDTO";

export {
  createGoodsReceiptSchema,
  goodsReceiptListQuerySchema,
} from "./validators/goods-receipt";
export type {
  CreateGoodsReceiptInput,
  GoodsReceiptListQuery,
} from "./validators/goods-receipt";

// Return to Vendor (RTV) — retur barang yang sudah diterima ke supplier.
import { GoodsReturnRepository } from "./repositories/GoodsReturnRepository";
import { GoodsReturnService } from "./services/GoodsReturnService";

export function getGoodsReturnService(): GoodsReturnService {
  return new GoodsReturnService(
    new GoodsReturnRepository(),
    new GoodsReceiptRepository(),
  );
}

export {
  GoodsReturnService,
  GoodsReturnNotFoundError,
  GoodsReturnInvalidError,
} from "./services/GoodsReturnService";

export type {
  GoodsReturnEntity,
  GoodsReturnItemEntity,
  GoodsReturnReason,
  GoodsReturnStatus,
} from "./domain/entities/GoodsReturn";
export {
  GOODS_RETURN_REASONS,
  GOODS_RETURN_STATUSES,
} from "./domain/entities/GoodsReturn";

export type {
  IGoodsReturnRepository,
  GoodsReturnCreateInput,
  GoodsReturnResolveInput,
  GoodsReturnListFilter,
  GoodsReturnListResult,
  GoodsReturnListSummary,
  GoodsReturnWithRelations,
} from "./domain/ports/IGoodsReturnRepository";

export {
  toGoodsReturnDTO,
  toGoodsReturnListItemDTO,
} from "./dto/GoodsReturnDTO";
export type {
  GoodsReturnDTO,
  GoodsReturnItemDTO,
  GoodsReturnListItemDTO,
  GoodsReturnListResponseDTO,
} from "./dto/GoodsReturnDTO";

export {
  createGoodsReturnSchema,
  resolveGoodsReturnSchema,
  goodsReturnListQuerySchema,
} from "./validators/goods-return";
export type {
  CreateGoodsReturnInput,
  ResolveGoodsReturnInput,
  GoodsReturnListQuery,
} from "./validators/goods-return";

// Approval Threshold — guard role × scope × nominal range untuk approve PR/PO.
import { ApprovalThresholdRepository } from "./repositories/ApprovalThresholdRepository";
import { ApprovalThresholdService } from "./services/ApprovalThresholdService";

export function getApprovalThresholdService(): ApprovalThresholdService {
  return new ApprovalThresholdService(new ApprovalThresholdRepository());
}

export {
  ApprovalThresholdService,
  ApprovalThresholdNotFoundError,
  ApprovalThresholdInvalidError,
  ApprovalThresholdExceededError,
} from "./services/ApprovalThresholdService";

export type {
  ApprovalThreshold,
  ApprovalThresholdScope,
} from "./domain/entities/ApprovalThreshold";
export { APPROVAL_THRESHOLD_SCOPES } from "./domain/entities/ApprovalThreshold";

export type {
  IApprovalThresholdRepository,
  ApprovalThresholdCreateInput,
  ApprovalThresholdUpdateInput,
  ApprovalThresholdListFilter,
  ApprovalThresholdWithRole,
} from "./domain/ports/IApprovalThresholdRepository";

export { toApprovalThresholdDTO } from "./dto/ApprovalThresholdDTO";
export type { ApprovalThresholdDTO } from "./dto/ApprovalThresholdDTO";

export {
  createApprovalThresholdSchema,
  updateApprovalThresholdSchema,
  approvalThresholdListQuerySchema,
} from "./validators/approval-threshold";
export type {
  CreateApprovalThresholdInput,
  UpdateApprovalThresholdInput,
  ApprovalThresholdListQuery,
} from "./validators/approval-threshold";
