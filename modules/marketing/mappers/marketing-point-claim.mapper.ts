import type { PointClaim, PointClaimStatus, Prisma } from "@prisma/client";
import type { PointClaimEntity } from "../domain/entities/PointClaimEntity";
import type { PointClaimDTO, PointClaimListItemDTO } from "../dto/MarketingDTO";

export type PrismaPointClaimDetail = PointClaim & {
  canvasing?: {
    id: string;
    nama: string;
    alamat: string;
    paket: string;
    workOrder?: {
      workOrderNumber: string;
      status: string;
    } | null;
  } | null;
  sales?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  reviewedBy?: {
    id: string;
    name: string | null;
  } | null;
};

export function toPointClaimDomain(
  entity: PrismaPointClaimDetail,
): PointClaimEntity {
  return {
    ...buildPointClaimBaseFields(entity),
    ...buildPointClaimRelationFields(entity),
  };
}

function buildPointClaimBaseFields(entity: PrismaPointClaimDetail) {
  return {
    id: entity.id,
    canvasingId: entity.canvasingId,
    salesId: entity.salesId,
    buktiUrls: entity.buktiUrls,
    buktiMetadata: toMetadataRecord(entity.buktiMetadata),
    keterangan: entity.keterangan,
    pointValue: entity.pointValue,
    status: entity.status as PointClaimStatus,
    reviewedById: entity.reviewedById,
    reviewedAt: entity.reviewedAt,
    reviewNotes: entity.reviewNotes,
    tenantId: entity.tenantId,
    isCashedOut: entity.isCashedOut,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function buildPointClaimRelationFields(entity: PrismaPointClaimDetail) {
  return {
    sales: mapPointClaimSales(entity.sales),
    reviewedBy: mapPointClaimReviewer(entity.reviewedBy),
    canvasing: mapPointClaimCanvasing(entity.canvasing),
  };
}

function mapPointClaimSales(sales: PrismaPointClaimDetail["sales"]) {
  return sales
    ? {
        id: sales.id,
        name: sales.name,
        email: sales.email,
      }
    : null;
}

function mapPointClaimReviewer(
  reviewedBy: PrismaPointClaimDetail["reviewedBy"],
) {
  return reviewedBy
    ? {
        id: reviewedBy.id,
        name: reviewedBy.name,
      }
    : null;
}

function mapPointClaimCanvasing(
  canvasing: PrismaPointClaimDetail["canvasing"],
) {
  return canvasing
    ? {
        id: canvasing.id,
        nama: canvasing.nama,
        alamat: canvasing.alamat,
        paket: canvasing.paket,
        workOrderNumber: canvasing.workOrder?.workOrderNumber ?? null,
        workOrderStatus: canvasing.workOrder?.status ?? null,
      }
    : null;
}

export function toPointClaimDTO(entity: PointClaimEntity): PointClaimDTO {
  return {
    id: entity.id,
    canvasingId: entity.canvasingId,
    salesId: entity.salesId,
    salesName: entity.sales?.name ?? null,
    buktiUrls: entity.buktiUrls,
    keterangan: entity.keterangan,
    status: entity.status,
    points: entity.pointValue,
    createdAt: entity.createdAt.toISOString(),
    processedAt: entity.reviewedAt?.toISOString() ?? null,
  };
}

export function toPointClaimListItemDTO(
  entity: PointClaimEntity,
): PointClaimListItemDTO {
  return {
    id: entity.id,
    salesName: entity.sales?.name ?? null,
    customerName: entity.canvasing?.nama ?? "",
    status: entity.status,
    points: entity.pointValue,
    createdAt: entity.createdAt.toISOString(),
  };
}

export function toPointClaimListDTO(
  items: PointClaimEntity[],
): PointClaimListItemDTO[] {
  return items.map((item) => toPointClaimListItemDTO(item));
}

function toMetadataRecord(
  metadata: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}
