import type {
  Canvasing,
  PointClaim,
  Prisma,
  PointClaimStatus,
  CanvasingStatus,
} from "@prisma/client";
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
  PointClaimDTO,
  PointClaimListItemDTO,
  LoyaltyPointBalanceDTO,
  PointHistoryDTO,
} from "../dto/MarketingDTO";
import type {
  CanvasingEntity,
  MitraReferenceEntity,
  SiteReferenceEntity,
} from "../domain/entities/CanvasingEntity";
import type {
  CanvasingClaimSubmissionEntity,
  PointClaimEntity,
} from "../domain/entities/PointClaimEntity";

const DEFAULT_POINT_VALUE = 2;

type PrismaCanvasingDetail = Canvasing & {
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

type PrismaCanvasingWithSite = Canvasing & {
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

type PrismaPointClaimDetail = PointClaim & {
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

type PrismaClaimSubmission = {
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

export class MarketingMapper {
  /** Map Prisma canvasing detail into a domain entity. */
  static toCanvasingDomain(entity: PrismaCanvasingDetail): CanvasingEntity {
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
      status: entity.status as CanvasingStatus,
      isLocked: entity.isLocked,
      salesId: entity.salesId,
      mitraId: entity.mitraId,
      approvedBy: entity.approvedBy,
      approvedAt: entity.approvedAt,
      workOrderId: entity.workOrderId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      user: entity.user
        ? {
            id: entity.user.id,
            name: entity.user.name,
            email: entity.user.email,
            siteId: entity.user.siteId,
          }
        : null,
      approver: entity.approver
        ? {
            id: entity.approver.id,
            name: entity.approver.name,
          }
        : null,
      workOrder: entity.workOrder
        ? {
            id: entity.workOrder.id ?? entity.workOrder.workOrderNumber,
            workOrderNumber: entity.workOrder.workOrderNumber,
            status: entity.workOrder.status,
          }
        : null,
      pointClaim: entity.pointClaims
        ? {
            id: entity.pointClaims.id,
            status: entity.pointClaims.status,
            buktiUrls: entity.pointClaims.buktiUrls,
            keterangan: entity.pointClaims.keterangan,
            pointValue: entity.pointClaims.pointValue,
            reviewNotes: entity.pointClaims.reviewNotes,
            reviewedAt: entity.pointClaims.reviewedAt,
            reviewedByName: entity.pointClaims.reviewedBy?.name ?? null,
            createdAt: entity.pointClaims.createdAt,
          }
        : null,
    };
  }

  /** Map Prisma canvasing with site relations into a domain entity. */
  static toCanvasingDomainWithSite(
    entity: PrismaCanvasingWithSite,
    mitra?: MitraReferenceEntity | null,
  ): CanvasingEntity {
    const detail = this.toCanvasingDomain(entity as PrismaCanvasingDetail);
    return {
      ...detail,
      user: entity.user
        ? {
            id: entity.user.id,
            name: entity.user.name,
            email: entity.user.email,
            siteId: entity.user.siteId,
            site: this.toSiteReference(entity.user.sites),
          }
        : null,
      mitra,
    };
  }

  /** Map Prisma point claim detail into a domain entity. */
  static toPointClaimDomain(entity: PrismaPointClaimDetail): PointClaimEntity {
    return {
      id: entity.id,
      canvasingId: entity.canvasingId,
      salesId: entity.salesId,
      buktiUrls: entity.buktiUrls,
      buktiMetadata: this.toMetadataRecord(entity.buktiMetadata),
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
      sales: entity.sales
        ? {
            id: entity.sales.id,
            name: entity.sales.name,
            email: entity.sales.email,
          }
        : null,
      reviewedBy: entity.reviewedBy
        ? {
            id: entity.reviewedBy.id,
            name: entity.reviewedBy.name,
          }
        : null,
      canvasing: entity.canvasing
        ? {
            id: entity.canvasing.id,
            nama: entity.canvasing.nama,
            alamat: entity.canvasing.alamat,
            paket: entity.canvasing.paket,
            workOrderNumber:
              entity.canvasing.workOrder?.workOrderNumber ?? null,
            workOrderStatus: entity.canvasing.workOrder?.status ?? null,
          }
        : null,
    };
  }

  /** Map Prisma canvasing claim submission into a domain entity. */
  static toClaimSubmissionDomain(
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

  /** Map canvasing domain entity into list DTO. */
  static toCanvasingListItemDTO(entity: CanvasingEntity): CanvasingListItemDTO {
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

  /** Map canvasing domain entities into list DTOs. */
  static toCanvasingListDTO(items: CanvasingEntity[]): CanvasingListItemDTO[] {
    return items.map((item) => this.toCanvasingListItemDTO(item));
  }

  /** Map canvasing domain entity into detail DTO. */
  static toCanvasingDetailDTO(entity: CanvasingEntity): CanvasingDetailDTO {
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
      workOrderId: entity.workOrderId,
      pointClaim: entity.pointClaim
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
        : null,
    };
  }

  /** Map point claim domain entity into DTO. */
  static toPointClaimDTO(entity: PointClaimEntity): PointClaimDTO {
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

  /** Map point claim domain entity into list DTO. */
  static toPointClaimListItemDTO(
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

  /** Map point claim domain entities into list DTOs. */
  static toPointClaimListDTO(
    items: PointClaimEntity[],
  ): PointClaimListItemDTO[] {
    return items.map((item) => this.toPointClaimListItemDTO(item));
  }

  /** Calculate point balance DTO from summary values. */
  static toPointBalance(dto: {
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

  /** Map point history input into DTO. */
  static toPointHistory(dto: {
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

  /** Return default approved point value. */
  static getDefaultPointValue(): number {
    return DEFAULT_POINT_VALUE;
  }

  private static toMetadataRecord(
    metadata: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }

    return metadata as Record<string, unknown>;
  }

  private static toSiteReference(
    site?: { id: string; name: string } | null,
  ): SiteReferenceEntity | null {
    if (!site) {
      return null;
    }

    return { id: site.id, name: site.name };
  }
}
