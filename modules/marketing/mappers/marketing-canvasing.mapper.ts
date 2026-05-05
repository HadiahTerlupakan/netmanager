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
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
  LoyaltyPointBalanceDTO,
  PointHistoryDTO,
} from "../dto/MarketingDTO";

const DEFAULT_POINT_VALUE = 2;

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
    sites?: {
      id: string;
      name: string;
    } | null;
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
          site: toSiteReference(entity.user.sites),
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

export function toCanvasingListItemDTO(
  entity: CanvasingEntity,
): CanvasingListItemDTO {
  return {
    id: entity.id,
    nama: entity.nama,
    noTelpon: entity.noTelpon,
    alamat: entity.alamat,
    paket: entity.paket,
    status: entity.status,
    salesName: entity.user?.name ?? entity.mitra?.name ?? null,
    createdAt: entity.createdAt.toISOString(),
  };
}

export function toCanvasingListDTO(
  items: CanvasingEntity[],
): CanvasingListItemDTO[] {
  return items.map((item) => toCanvasingListItemDTO(item));
}

export function toCanvasingDetailDTO(
  entity: CanvasingEntity,
): CanvasingDetailDTO {
  return {
    ...buildCanvasingDetailBaseDTO(entity),
    ...buildCanvasingDetailRelationsDTO(entity),
  };
}

function buildCanvasingDetailBaseDTO(entity: CanvasingEntity) {
  return {
    id: entity.id,
    nama: entity.nama,
    noKtp: entity.noKtp,
    noTelpon: entity.noTelpon,
    email: entity.email,
    alamat: entity.alamat,
    kabel: entity.kabel,
    odp: entity.odp,
    paket: entity.paket,
    sn: entity.sn,
    latitude: entity.latitude,
    longitude: entity.longitude,
    foto: entity.foto,
    fotoKtp: entity.fotoKtp,
    status: entity.status,
    isLocked: entity.isLocked,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    salesId: entity.salesId,
    workOrderId: entity.workOrderId,
  };
}

function buildCanvasingDetailRelationsDTO(entity: CanvasingEntity) {
  return {
    sales: {
      id: entity.user?.id ?? entity.salesId ?? "",
      name: entity.user?.name ?? entity.mitra?.name ?? null,
    },
    approver: entity.approver
      ? {
          id: entity.approver.id,
          name: entity.approver.name,
        }
      : null,
    approvedAt: entity.approvedAt?.toISOString() ?? null,
    pointClaim: mapCanvasingPointClaimDTO(entity),
  };
}

function mapCanvasingPointClaimDTO(entity: CanvasingEntity) {
  return entity.pointClaim
    ? {
        id: entity.pointClaim.id,
        canvasingId: entity.id,
        salesId: entity.salesId ?? "",
        salesName: entity.user?.name ?? null,
        buktiUrls: entity.pointClaim.buktiUrls,
        keterangan: entity.pointClaim.keterangan,
        status: entity.pointClaim.status as PointClaimStatus,
        points: entity.pointClaim.pointValue,
        createdAt: entity.pointClaim.createdAt.toISOString(),
        processedAt: entity.pointClaim.reviewedAt?.toISOString() ?? null,
      }
    : null;
}

export function toPointBalance(dto: {
  userId: string;
  userName: string | null;
  totalEarned: number;
  pendingPoints: number;
  redeemedPoints: number;
}): LoyaltyPointBalanceDTO {
  return {
    userId: dto.userId,
    userName: dto.userName,
    totalPoints: dto.totalEarned,
    pendingPoints: dto.pendingPoints,
    redeemedPoints: dto.redeemedPoints,
    availablePoints: dto.totalEarned - dto.pendingPoints - dto.redeemedPoints,
  };
}

export function toPointHistory(dto: {
  id: string;
  type: "EARN" | "REDEEM";
  points: number;
  description: string;
  createdAt: Date;
}): PointHistoryDTO {
  return {
    id: dto.id,
    type: dto.type,
    points: dto.points,
    description: dto.description,
    createdAt: dto.createdAt.toISOString(),
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
