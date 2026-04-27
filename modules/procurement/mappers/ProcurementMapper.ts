import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseRequest,
  PurchaseRequestItem,
} from "@prisma/client";

import type {
  PurchaseOrderDTO,
  PurchaseOrderItemDTO,
} from "../dto/ProcurementDTO";
import type {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
} from "../domain/entities/PurchaseOrder";
import type {
  PurchaseRequestEntity,
  PurchaseRequestItemEntity,
} from "../domain/entities/PurchaseRequest";

type PurchaseRequestRecord = PurchaseRequest & {
  items: (PurchaseRequestItem & {
    barang: { id: string; nama: string; supplierId: string | null };
  })[];
};

/** Memetakan record purchase request Prisma ke domain entity. */
export function toPurchaseRequestDomain(
  record: PurchaseRequestRecord,
): PurchaseRequestEntity {
  return {
    id: record.id,
    tenantId: record.tenantId,
    status: record.status,
    purchaseOrderId: record.purchaseOrderId,
    items: record.items.map(toPurchaseRequestItemDomain),
  };
}

/** Memetakan record purchase order Prisma ke domain entity. */
export function toPurchaseOrderDomain(
  record: PurchaseOrder & { items?: PurchaseOrderItem[] },
): PurchaseOrderEntity {
  return {
    id: record.id,
    poNumber: record.poNumber,
    supplierId: record.supplierId,
    status: record.status,
    totalAmount: record.totalAmount,
    issuedAt: record.issuedAt,
    expectedDate: record.expectedDate,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    processedById: record.processedById,
    receivedById: record.receivedById,
    fotoBukti: record.fotoBukti,
    grandTotal: record.grandTotal,
    paidFromAccountId: record.paidFromAccountId,
    paymentStatus: record.paymentStatus,
    ppnAmount: record.ppnAmount,
    ppnRate: record.ppnRate,
    tenantId: record.tenantId,
    items: record.items?.map(toPurchaseOrderItemDomain),
  };
}

/** Memetakan purchase order domain entity ke DTO publik module. */
export function toPurchaseOrderDTO(
  entity: PurchaseOrderEntity,
): PurchaseOrderDTO {
  return {
    ...entity,
    items: entity.items?.map(toPurchaseOrderItemDTO),
  };
}

function toPurchaseRequestItemDomain(
  item: PurchaseRequestRecord["items"][number],
): PurchaseRequestItemEntity {
  return {
    id: item.id,
    barangId: item.barangId,
    jumlah: item.jumlah,
    hargaPerUnit: item.hargaPerUnit,
    totalHarga: item.totalHarga,
    tenantId: item.tenantId,
    barang: {
      id: item.barang.id,
      nama: item.barang.nama,
      supplierId: item.barang.supplierId,
    },
  };
}

function toPurchaseOrderItemDomain(
  item: PurchaseOrderItem,
): PurchaseOrderItemEntity {
  return {
    id: item.id,
    barangId: item.barangId,
    quantity: item.quantity,
    receivedQuantity: item.receivedQuantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    tenantId: item.tenantId,
  };
}

function toPurchaseOrderItemDTO(
  item: PurchaseOrderItemEntity,
): PurchaseOrderItemDTO {
  return { ...item };
}
