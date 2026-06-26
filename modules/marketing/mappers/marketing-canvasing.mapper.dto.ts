import type { CanvasingEntity } from "../domain/entities/CanvasingEntity";
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
  LoyaltyPointBalanceDTO,
  PointHistoryDTO,
} from "../dto/MarketingDTO";
import type { PointClaimStatus } from "@prisma/client";

export function toCanvasingListItemDTO(
  entity: CanvasingEntity,
): CanvasingListItemDTO {
  const pointClaim = mapCanvasingPointClaimDTO(entity);

  return {
    id: entity.id,
    nama: entity.nama,
    noTelpon: entity.noTelpon,
    alamat: entity.alamat,
    paket: entity.paket,
    status: entity.status,
    salesName: entity.user?.name ?? entity.mitra?.name ?? null,
    createdAt: entity.createdAt.toISOString(),
    workOrder: entity.workOrder
      ? {
          id: entity.workOrder.id,
          workOrderNumber: entity.workOrder.workOrderNumber,
          status: entity.workOrder.status,
        }
      : null,
    pointClaims: pointClaim,
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
    shareloc: entity.shareloc,
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
    workOrder: entity.workOrder
      ? {
          id: entity.workOrder.id,
          workOrderNumber: entity.workOrder.workOrderNumber,
          status: entity.workOrder.status,
        }
      : null,
    pointClaims: mapCanvasingPointClaimDTO(entity),
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
