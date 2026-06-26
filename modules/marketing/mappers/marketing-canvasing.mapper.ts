import type {
  Canvasing,
  CanvasingStatus,
  PointClaimStatus,
} from "@prisma/client";
import type { CanvasingClaimSubmissionEntity } from "../domain/entities/PointClaimEntity";
import type {
  CanvasingEntity,
  MitraReferenceEntity,
  SiteReferenceEntity,
} from "../domain/entities/CanvasingEntity";

import { DEFAULT_POINT_VALUE } from "../config/marketing-points";

export type PrismaCanvasingDetail = Canvasing & {
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    siteId: string | null;
  } | null;
  approver?: {
    id: string;
    name: string | null;
  } | null;
  workOrder?: {
    id?: string;
    workOrderNumber: string;
    status: string;
  } | null;
  pointClaims?: {
    id: string;
    status: PointClaimStatus;
    buktiUrls: string[];
    keterangan: string | null;
    pointValue: number;
    reviewNotes: string | null;
    reviewedAt: Date | null;
    reviewedBy?: {
      name: string | null;
    } | null;
    createdAt: Date;
  } | null;
};

export type PrismaCanvasingWithSite = Canvasing & {
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    siteId: string | null;
    sites?:
      | {
          id: string;
          name: string;
        }
      | Array<{
          id: string;
          name: string;
        }>
      | null;
  } | null;
};

export type PrismaClaimSubmission = {
  id: string;
  nama: string;
  salesId: string;
  isLocked: boolean;
  workOrder: {
    status: string;
  } | null;
  pointClaims: {
    id: string;
  } | null;
  user: {
    name: string | null;
    siteId: string | null;
  } | null;
};

export function toCanvasingDomain(
  entity: PrismaCanvasingDetail,
): CanvasingEntity {
  return {
    ...buildCanvasingBaseFields(entity),
    ...buildCanvasingLocationFields(entity),
    ...buildCanvasingRelationFields(entity),
  };
}

function buildCanvasingBaseFields(entity: PrismaCanvasingDetail) {
  return {
    id: entity.id,
    nama: entity.nama,
    noKtp: entity.noKtp,
    noTelpon: entity.noTelpon,
    email: entity.email,
    alamat: entity.alamat,
    status: entity.status as CanvasingStatus,
    isLocked: entity.isLocked,
    salesId: entity.salesId,
    mitraId: entity.mitraId,
    approvedBy: entity.approvedBy,
    approvedAt: entity.approvedAt,
    workOrderId: entity.workOrderId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function buildCanvasingLocationFields(entity: PrismaCanvasingDetail) {
  return {
    kabel: entity.kabel,
    odp: entity.odp,
    paket: entity.paket,
    sn: entity.sn,
    latitude: entity.latitude,
    longitude: entity.longitude,
    shareloc: entity.shareloc,
    foto: entity.foto,
    fotoKtp: entity.fotoKtp,
  };
}

function buildCanvasingRelationFields(entity: PrismaCanvasingDetail) {
  return {
    user: mapCanvasingUser(entity.user),
    approver: mapCanvasingApprover(entity.approver),
    workOrder: mapCanvasingWorkOrder(entity.workOrder),
    pointClaim: mapCanvasingPointClaim(entity.pointClaims),
  };
}

function mapCanvasingUser(user: PrismaCanvasingDetail["user"]) {
  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        siteId: user.siteId,
      }
    : null;
}

function mapCanvasingApprover(approver: PrismaCanvasingDetail["approver"]) {
  return approver
    ? {
        id: approver.id,
        name: approver.name,
      }
    : null;
}

function mapCanvasingWorkOrder(workOrder: PrismaCanvasingDetail["workOrder"]) {
  return workOrder
    ? {
        id: workOrder.id ?? workOrder.workOrderNumber,
        workOrderNumber: workOrder.workOrderNumber,
        status: workOrder.status,
      }
    : null;
}

function mapCanvasingPointClaim(
  pointClaims: PrismaCanvasingDetail["pointClaims"],
) {
  return pointClaims
    ? {
        id: pointClaims.id,
        status: pointClaims.status,
        buktiUrls: pointClaims.buktiUrls,
        keterangan: pointClaims.keterangan,
        pointValue: pointClaims.pointValue,
        reviewNotes: pointClaims.reviewNotes,
        reviewedAt: pointClaims.reviewedAt,
        reviewedByName: pointClaims.reviewedBy?.name ?? null,
        createdAt: pointClaims.createdAt,
      }
    : null;
}

export function toCanvasingDomainWithSite(
  entity: PrismaCanvasingWithSite,
  mitra?: MitraReferenceEntity | null,
): CanvasingEntity {
  const detail = toCanvasingDomain(entity as PrismaCanvasingDetail);
  return {
    ...detail,
    user: entity.user
      ? {
          id: entity.user.id,
          name: entity.user.name,
          email: entity.user.email,
          siteId: entity.user.siteId,
          site: toSiteReference(
            Array.isArray(entity.user.sites)
              ? entity.user.sites[0]
              : entity.user.sites,
          ),
        }
      : null,
    mitra,
  };
}

export function toClaimSubmissionDomain(
  entity: PrismaClaimSubmission,
): CanvasingClaimSubmissionEntity {
  return {
    id: entity.id,
    nama: entity.nama,
    salesId: entity.salesId,
    isLocked: entity.isLocked,
    workOrderStatus: entity.workOrder?.status ?? null,
    hasPointClaim: Boolean(entity.pointClaims),
    userName: entity.user?.name ?? null,
    userSiteId: entity.user?.siteId ?? null,
  };
}

export function getDefaultPointValue(): number {
  return DEFAULT_POINT_VALUE;
}

function toSiteReference(
  site?: { id: string; name: string } | null,
): SiteReferenceEntity | null {
  if (!site) {
    return null;
  }

  return { id: site.id, name: site.name };
}
