import {
  getDefaultPointValue,
  toCanvasingDetailDTO,
  toCanvasingDomain,
  toCanvasingDomainWithSite,
  toCanvasingListDTO,
  toCanvasingListItemDTO,
  toClaimSubmissionDomain,
  toPointBalance,
  toPointClaimDomain,
  toPointClaimDTO,
  toPointClaimListDTO,
  toPointClaimListItemDTO,
  toPointHistory,
  type PrismaCanvasingDetail,
  type PrismaCanvasingWithSite,
  type PrismaClaimSubmission,
  type PrismaPointClaimDetail,
} from "./marketing.mapper.helpers";
import type {
  CanvasingEntity,
  MitraReferenceEntity,
} from "../domain/entities/CanvasingEntity";
import type {
  CanvasingClaimSubmissionEntity,
  PointClaimEntity,
} from "../domain/entities/PointClaimEntity";
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
  LoyaltyPointBalanceDTO,
  PointClaimDTO,
  PointClaimListItemDTO,
  PointHistoryDTO,
} from "../dto/MarketingDTO";

export class MarketingMapper {
  /** Map Prisma canvasing detail into a domain entity. */
  static toCanvasingDomain(entity: PrismaCanvasingDetail): CanvasingEntity {
    return toCanvasingDomain(entity);
  }

  /** Map Prisma canvasing with site relations into a domain entity. */
  static toCanvasingDomainWithSite(
    entity: PrismaCanvasingWithSite,
    mitra?: MitraReferenceEntity | null,
  ): CanvasingEntity {
    return toCanvasingDomainWithSite(entity, mitra);
  }

  /** Map Prisma point claim detail into a domain entity. */
  static toPointClaimDomain(entity: PrismaPointClaimDetail): PointClaimEntity {
    return toPointClaimDomain(entity);
  }

  /** Map Prisma canvasing claim submission into a domain entity. */
  static toClaimSubmissionDomain(
    entity: PrismaClaimSubmission,
  ): CanvasingClaimSubmissionEntity {
    return toClaimSubmissionDomain(entity);
  }

  /** Map canvasing domain entity into list DTO. */
  static toCanvasingListItemDTO(entity: CanvasingEntity): CanvasingListItemDTO {
    return toCanvasingListItemDTO(entity);
  }

  /** Map canvasing domain entities into list DTOs. */
  static toCanvasingListDTO(items: CanvasingEntity[]): CanvasingListItemDTO[] {
    return toCanvasingListDTO(items);
  }

  /** Map canvasing domain entity into detail DTO. */
  static toCanvasingDetailDTO(entity: CanvasingEntity): CanvasingDetailDTO {
    return toCanvasingDetailDTO(entity);
  }

  /** Map point claim domain entity into DTO. */
  static toPointClaimDTO(entity: PointClaimEntity): PointClaimDTO {
    return toPointClaimDTO(entity);
  }

  /** Map point claim domain entity into list DTO. */
  static toPointClaimListItemDTO(
    entity: PointClaimEntity,
  ): PointClaimListItemDTO {
    return toPointClaimListItemDTO(entity);
  }

  /** Map point claim domain entities into list DTOs. */
  static toPointClaimListDTO(
    items: PointClaimEntity[],
  ): PointClaimListItemDTO[] {
    return toPointClaimListDTO(items);
  }

  /** Calculate point balance DTO from summary values. */
  static toPointBalance(dto: {
    userId: string;
    userName: string | null;
    totalEarned: number;
    pendingPoints: number;
    redeemedPoints: number;
  }): LoyaltyPointBalanceDTO {
    return toPointBalance(dto);
  }

  /** Map point history input into DTO. */
  static toPointHistory(dto: {
    id: string;
    type: "EARN" | "REDEEM";
    points: number;
    description: string;
    createdAt: Date;
  }): PointHistoryDTO {
    return toPointHistory(dto);
  }

  /** Return default approved point value. */
  static getDefaultPointValue(): number {
    return getDefaultPointValue();
  }
}
