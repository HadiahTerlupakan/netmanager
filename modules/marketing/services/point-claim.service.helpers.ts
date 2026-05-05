import type { TargetSchema } from "@prisma/client";
import { prisma } from "@/modules/database";
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

const CASHOUT_DEFAULT_TARGET = 30;
const ACCUMULATED_TARGET_SCHEMA: TargetSchema = "ACCUMULATED";
const COMPLETED_WORK_ORDER_STATUSES = ["COMPLETED", "VERIFIED", "CLOSED"];

export async function requireClaimableCanvasing(
  repository: IPointClaimRepository,
  data: CreatePointClaimInput,
): Promise<CanvasingClaimSubmissionEntity> {
  const canvasing = await repository.findCanvasingClaimSubmission(
    data.canvasingId,
  );

  if (!canvasing) {
    throw new Error("Canvasing tidak ditemukan");
  }

  if (canvasing.salesId !== data.salesId) {
    throw new Error("Anda tidak memiliki akses ke canvasing ini");
  }

  if (canvasing.isLocked) {
    throw new Error("Canvasing sudah dikunci, tidak bisa diubah");
  }

  if (!canvasing.workOrderStatus) {
    throw new Error("Work Order belum dibuat untuk canvasing ini");
  }

  if (!COMPLETED_WORK_ORDER_STATUSES.includes(canvasing.workOrderStatus)) {
    throw new Error(
      `Work Order belum selesai. Status saat ini: ${canvasing.workOrderStatus}`,
    );
  }

  if (canvasing.hasPointClaim) {
    throw new Error("Claim sudah pernah diajukan untuk canvasing ini");
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

  throw new Error("Claim tidak ditemukan");
}

export async function requirePendingClaim(
  repository: IPointClaimRepository,
  id: string,
): Promise<PointClaimEntity> {
  const claim = await requireExistingClaim(repository, id);
  if (claim.status === PENDING_STATUS) {
    return claim;
  }

  throw new Error("Hanya claim dengan status PENDING yang bisa diproses");
}

export function ensureRejectNotes(notes: string): void {
  if (notes.trim()) {
    return;
  }

  throw new Error("Alasan penolakan wajib diisi");
}

export function createRejectedClaim(
  claim: PointClaimEntity,
  reviewerId: string,
  notes: string,
): PointClaimEntity {
  return {
    ...claim,
    status: REJECTED_STATUS,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
    reviewNotes: notes,
  };
}

export async function requireEligibleCashoutUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSales: true, canvasingTarget: true, targetSchema: true },
  });

  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  if (!user.isSales) {
    throw new Error("Hanya akun sales yang dapat mencairkan bonus canvasing.");
  }

  if (user.targetSchema !== ACCUMULATED_TARGET_SCHEMA) {
    throw new Error(
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
