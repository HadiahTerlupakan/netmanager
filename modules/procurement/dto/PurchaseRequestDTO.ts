import type { PurchaseRequestSummaryEntity } from "../domain/entities/PurchaseRequest";

export interface PurchaseRequestSummaryDTO {
  id: string;
  nomorRequest: string;
  status: string;
  prioritas: string;
  tanggal: string;
  approvedAt: string | null;
  purchaseOrderId: string | null;
  requesterName: string | null;
  gudangNama: string | null;
  totalItems: number;
  totalNilai: number;
}

export interface PurchaseRequestListResponseDTO {
  data: PurchaseRequestSummaryDTO[];
  total: number;
  page: number;
  limit: number;
}

export function toPurchaseRequestSummaryDTO(
  entity: PurchaseRequestSummaryEntity,
): PurchaseRequestSummaryDTO {
  return {
    id: entity.id,
    nomorRequest: entity.nomorRequest,
    status: entity.status,
    prioritas: entity.prioritas,
    tanggal: entity.tanggal.toISOString(),
    approvedAt: entity.approvedAt ? entity.approvedAt.toISOString() : null,
    purchaseOrderId: entity.purchaseOrderId,
    requesterName: entity.requesterName,
    gudangNama: entity.gudangNama,
    totalItems: entity.totalItems,
    totalNilai: entity.totalNilai,
  };
}
