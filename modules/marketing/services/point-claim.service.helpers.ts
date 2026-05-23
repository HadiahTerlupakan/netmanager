import { prisma } from "@/modules/database";
import {
  ACCUMULATED_TARGET_SCHEMA,
  CASHOUT_DEFAULT_TARGET,
  COMPLETED_WORK_ORDER_STATUSES,
} from "../config/marketing-points";
import { MarketingError } from "../domain/errors/MarketingError";
import type {
  CanvasingClaimSubmissionEntity,
  PointClaimEntity,
} from "../domain/entities/PointClaimEntity";
import type {
  CreatePointClaimInput,
  IPointClaimRepository,
} from "../domain/ports/IPointClaimRepository";

export const PENDING_STATUS = "PENDING" as const;
export const APPROVED_STATUS = "APPROVED" as const;
export const REJECTED_STATUS = "REJECTED" as const;

export async function requireClaimableCanvasing(
  repository: IPointClaimRepository,
  data: CreatePointClaimInput,
): Promise<CanvasingClaimSubmissionEntity> {
  const canvasing = await repository.findCanvasingClaimSubmission(
    data.canvasingId,
  );

  if (!canvasing) {
    throw new MarketingError("not_found", "Canvasing tidak ditemukan");
  }

  if (canvasing.salesId !== data.salesId) {
    throw new MarketingError(
      "forbidden",
      "Anda tidak memiliki akses ke canvasing ini",
    );
  }

  if (canvasing.isLocked) {
    throw new MarketingError(
      "forbidden",
      "Canvasing sudah dikunci, tidak bisa diubah",
    );
  }

  if (!canvasing.workOrderStatus) {
    throw new MarketingError(
      "validation",
      "Work Order belum dibuat untuk canvasing ini",
    );
  }

  if (!COMPLETED_WORK_ORDER_STATUSES.includes(canvasing.workOrderStatus)) {
    throw new MarketingError(
      "validation",
      `Work Order belum selesai. Status saat ini: ${canvasing.workOrderStatus}`,
    );
  }

  if (canvasing.hasPointClaim) {
    throw new MarketingError(
      "validation",
      "Claim sudah pernah diajukan untuk canvasing ini",
    );
  }

  return canvasing;
}

export async function requireExistingClaim(
  repository: IPointClaimRepository,
  id: string,
): Promise<PointClaimEntity> {
  const claim = await repository.findById(id);
  if (claim) {
    return claim;
  }

  throw new MarketingError("not_found", "Claim tidak ditemukan");
}

export async function requirePendingClaim(
  repository: IPointClaimRepository,
  id: string,
): Promise<PointClaimEntity> {
  const claim = await requireExistingClaim(repository, id);
  if (claim.status === PENDING_STATUS) {
    return claim;
  }

  throw new MarketingError(
    "invalid_status",
    "Hanya claim dengan status PENDING yang bisa diproses",
  );
}

export function ensureRejectNotes(notes: string): void {
  if (notes.trim()) {
    return;
  }

  throw new MarketingError("validation", "Alasan penolakan wajib diisi");
}

export async function requireEligibleCashoutUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSales: true, canvasingTarget: true, targetSchema: true },
  });

  if (!user) {
    throw new MarketingError("not_found", "User tidak ditemukan");
  }

  if (!user.isSales) {
    throw new MarketingError(
      "forbidden",
      "Hanya akun sales yang dapat mencairkan bonus canvasing.",
    );
  }

  if (user.targetSchema !== ACCUMULATED_TARGET_SCHEMA) {
    throw new MarketingError(
      "validation",
      "Akun Anda menggunakan skema Target Bulanan. Pencairan dilakukan otomatis di akhir bulan.",
    );
  }

  return user;
}

export function resolveCashoutTarget(canvasingTarget: number | null): number {
  return canvasingTarget || CASHOUT_DEFAULT_TARGET;
}

export function filterCashoutEligibleClaims(
  claims: PointClaimEntity[],
): PointClaimEntity[] {
  return claims.filter((claim) => !claim.isCashedOut);
}
