import type {
  IPointClaimRepository,
  CreatePointClaimInput,
  PointClaimFilters,
} from "../domain/ports/IPointClaimRepository";
import type {
  PointClaimDashboardSummaryEntity,
  PointSummaryEntity,
} from "../domain/entities/PointClaimEntity";
import type { PointClaimDTO, PointClaimListItemDTO } from "../dto/MarketingDTO";
import { MarketingError } from "../domain/errors/MarketingError";
import { MarketingMapper } from "../mappers/MarketingMapper";
import { addMitraCommissionIfEligible } from "./point-claim.commission";
import {
  notifyApprovedClaim,
  notifyRejectedClaim,
  notifySubmittedClaim,
} from "./point-claim.notifications";
import {
  APPROVED_STATUS,
  ensureRejectNotes,
  filterCashoutEligibleClaims,
  requireClaimableCanvasing,
  requireEligibleCashoutUser,
  requireExistingClaim,
  requirePendingClaim,
  resolveCashoutTarget,
} from "./point-claim.service.helpers";

export class PointClaimService {
  constructor(private readonly repository: IPointClaimRepository) {}

  /** Submit a point claim and return a response DTO. */
  async submitClaim(data: CreatePointClaimInput): Promise<PointClaimDTO> {
    const canvasing = await requireClaimableCanvasing(this.repository, data);
    const claim = await this.repository.createWithCanvasingLock(data);
    notifySubmittedClaim(canvasing, claim);
    return MarketingMapper.toPointClaimDTO(claim);
  }

  /** Get point claim detail by id. */
  async getClaimById(id: string): Promise<PointClaimDTO | null> {
    const claim = await this.repository.findById(id);
    return claim ? MarketingMapper.toPointClaimDTO(claim) : null;
  }

  /** Get point claim detail by canvasing id. */
  async getClaimByCanvasingId(
    canvasingId: string,
  ): Promise<PointClaimDTO | null> {
    const claim = await this.repository.findByCanvasingId(canvasingId);
    return claim ? MarketingMapper.toPointClaimDTO(claim) : null;
  }

  /** Get point claim list for API responses. */
  async getAllClaims(
    filters?: PointClaimFilters,
  ): Promise<PointClaimListItemDTO[]> {
    const claims = await this.repository.findAll(filters);
    return MarketingMapper.toPointClaimListDTO(claims);
  }

  /** Get point summary for a sales user. */
  async getPointSummary(salesId: string): Promise<PointSummaryEntity> {
    return this.repository.getPointSummaryBySales(salesId);
  }

  /** Return dashboard summary for point claims. */
  async getDashboardSummary(
    tenantId: string,
  ): Promise<PointClaimDashboardSummaryEntity> {
    return this.repository.getDashboardSummary(tenantId);
  }

  /** Approve point claim and return a response DTO. */
  async approveClaim(
    id: string,
    reviewerId: string,
    notes?: string,
  ): Promise<PointClaimDTO> {
    const claim = await requirePendingClaim(this.repository, id);
    const approved = await this.repository.update(id, {
      status: APPROVED_STATUS,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      ...(notes ? { reviewNotes: notes } : {}),
    });
    notifyApprovedClaim(claim);
    await addMitraCommissionIfEligible(approved, id);

    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus.publish(EVENT_NAMES.MARKETING_POINT_CLAIM_APPROVED, {
      claimId: approved.id,
      canvasingId: approved.canvasingId,
      salesId: approved.salesId,
      reviewerId,
      pointValue: approved.pointValue,
      approvedAt: (approved.reviewedAt ?? new Date()).toISOString(),
      tenantId: approved.tenantId ?? undefined,
      triggeredBy: reviewerId,
    });

    return MarketingMapper.toPointClaimDTO(approved);
  }

  /**
   * Reject point claim, unlock canvasing, and return a response DTO.
   * Why: sebelumnya reject DELETE row sehingga audit trail hilang. Sekarang
   * tetap simpan record dengan status REJECTED + alasan reviewer, dan unlock
   * canvasing dilakukan atomik bersama update status.
   */
  async rejectClaim(
    id: string,
    reviewerId: string,
    notes: string,
  ): Promise<PointClaimDTO> {
    const claim = await requirePendingClaim(this.repository, id);
    ensureRejectNotes(notes);
    const rejected = await this.repository.rejectAndUnlock({
      id,
      reviewerId,
      reviewNotes: notes,
      canvasingId: claim.canvasingId,
    });
    notifyRejectedClaim(rejected, notes, id);
    return MarketingMapper.toPointClaimDTO(rejected);
  }

  /** Delete a pending point claim. */
  async deleteClaim(id: string): Promise<void> {
    const claim = await requireExistingClaim(this.repository, id);
    if (claim.status === APPROVED_STATUS) {
      throw new MarketingError(
        "invalid_status",
        "Claim yang sudah disetujui tidak bisa dihapus",
      );
    }
    if (claim.isCashedOut) {
      throw new MarketingError(
        "invalid_status",
        "Claim yang sudah dicairkan tidak bisa dihapus",
      );
    }

    await this.repository.deleteAndUnlock({
      id,
      canvasingId: claim.canvasingId,
    });
  }

  /** Cash out approved accumulated claims for a sales user. */
  async cashoutAccumulatedClaims(
    userId: string,
  ): Promise<{ cashedOutCount: number }> {
    const user = await requireEligibleCashoutUser(userId);
    const target = resolveCashoutTarget(user.canvasingTarget);
    const claims = filterCashoutEligibleClaims(
      await this.repository.findAll({
        salesId: userId,
        status: APPROVED_STATUS,
      }),
    );

    if (claims.length < target) {
      throw new MarketingError(
        "validation",
        `Belum mencapai target minimal pencairan (${target} canvasing). Poin saat ini: ${claims.length}.`,
      );
    }

    await this.repository.markClaimsAsCashedOut(claims.map((c) => c.id));
    return { cashedOutCount: claims.length };
  }
}
