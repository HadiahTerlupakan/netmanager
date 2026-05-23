export type {
  PurchaseOrderDTO,
  PurchaseOrderItemDTO,
} from "./dto/ProcurementDTO";
export * from "./services/ProcurementService";

// Purchase Order — fully owned by procurement now (sebelumnya di finance).
import { PurchaseOrderRepository } from "./repositories/PurchaseOrderRepository";
import { PurchaseOrderPaymentService } from "./services/PurchaseOrderPaymentService";
import { PurchaseOrderService } from "./services/PurchaseOrderService";
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

// Supplier sub-module — master vendor untuk PO/Expense (NPWP, defaultPphCategory)
export function getSupplierService(): SupplierService {
  return new SupplierService(new SupplierRepository());
}

export {
  SupplierService,
  SupplierCodeAlreadyExistsError,
  SupplierNotFoundError,
} from "./services/SupplierService";

export type { Supplier, SupplierPphCategory } from "./domain/entities/Supplier";
export { SUPPLIER_PPH_CATEGORIES } from "./domain/entities/Supplier";

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
