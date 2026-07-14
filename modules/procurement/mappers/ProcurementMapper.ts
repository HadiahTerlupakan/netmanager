import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderJasaItem,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestJasaItem,
} from "@prisma/client";

import type {
  PurchaseOrderDTO,
  PurchaseOrderItemDTO,
} from "../dto/ProcurementDTO";
import type {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
  PurchaseOrderJasaItemEntity,
} from "../domain/entities/PurchaseOrder";
import type {
  PurchaseRequestEntity,
  PurchaseRequestItemEntity,
  PurchaseRequestJasaItemEntity,
} from "../domain/entities/PurchaseRequest";

type PurchaseRequestRecord = PurchaseRequest & {
  items: (PurchaseRequestItem & {
    barang: { id: string; nama: string; supplierId: string | null };
  })[];
  jasaItems: (PurchaseRequestJasaItem & {
    jasa: {
      id: string;
      kode: string;
      nama: string;
      satuan: string;
      supplierId: string | null;
    };
  })[];
};

export function toPurchaseRequestDomain(
  record: PurchaseRequestRecord,
): PurchaseRequestEntity {
  return {
    id: record.id,
    tenantId: record.tenantId,
    status: record.status,
    purchaseOrderId: record.purchaseOrderId,
    items: record.items.map(toPurchaseRequestItemDomain),
    jasaItems: record.jasaItems.map(toPurchaseRequestJasaItemDomain),
  };
}

export function toPurchaseOrderDomain(
  record: PurchaseOrder & {
    items?: PurchaseOrderItem[];
    jasaItems?: PurchaseOrderJasaItem[];
  },
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
    fakturPajakNo: record.fakturPajakNo,
    fakturPajakDate: record.fakturPajakDate,
    vendorNpwp: record.vendorNpwp,
    tenantId: record.tenantId,
    items: record.items?.map(toPurchaseOrderItemDomain),
    jasaItems: record.jasaItems?.map(toPurchaseOrderJasaItemDomain),
  };
}

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

function toPurchaseRequestJasaItemDomain(
  item: PurchaseRequestJasaItem & {
    jasa: {
      id: string;
      kode: string;
      nama: string;
      satuan: string;
      supplierId: string | null;
    };
  },
): PurchaseRequestJasaItemEntity {
  return {
    id: item.id,
    jasaId: item.jasaId,
    jumlah: item.jumlah,
    hargaPerUnit: item.hargaPerUnit,
    totalHarga: item.totalHarga,
    tenantId: item.tenantId,
    jasa: {
      id: item.jasa.id,
      kode: item.jasa.kode,
      nama: item.jasa.nama,
      satuan: item.jasa.satuan,
      supplierId: item.jasa.supplierId,
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

function toPurchaseOrderJasaItemDomain(
  item: PurchaseOrderJasaItem,
): PurchaseOrderJasaItemEntity {
  return {
    id: item.id,
    jasaId: item.jasaId,
    quantity: item.quantity,
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
