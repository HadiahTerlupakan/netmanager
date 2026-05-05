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
import { MarketingMapper } from "../mappers/MarketingMapper";
import { addMitraCommissionIfEligible } from "./point-claim.commission";
import {
  notifyApprovedClaim,
  notifyRejectedClaim,
  notifySubmittedClaim,
} from "./point-claim.notifications";
import {
  APPROVED_STATUS,
  createRejectedClaim,
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
    const claim = await this.repository.create(data);
    await this.repository.updateCanvasingLock(data.canvasingId, true);
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
    return MarketingMapper.toPointClaimDTO(approved);
  }

  /** Reject point claim and return a response DTO. */
  async rejectClaim(
    id: string,
    reviewerId: string,
    notes: string,
  ): Promise<PointClaimDTO> {
    const claim = await requirePendingClaim(this.repository, id);
    ensureRejectNotes(notes);
    await this.repository.updateCanvasingLock(claim.canvasingId, false);
    notifyRejectedClaim(claim, notes, id);
    await this.repository.delete(id);
    return MarketingMapper.toPointClaimDTO(
      createRejectedClaim(claim, reviewerId, notes),
    );
  }

  /** Delete a pending point claim. */
  async deleteClaim(id: string): Promise<void> {
    const claim = await requireExistingClaim(this.repository, id);
    if (claim.status === APPROVED_STATUS) {
      throw new Error("Claim yang sudah disetujui tidak bisa dihapus");
    }

    await this.repository.updateCanvasingLock(claim.canvasingId, false);
    await this.repository.delete(id);
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
      throw new Error(
        `Belum mencapai target minimal pencairan (${target} canvasing). Poin saat ini: ${claims.length}.`,
      );
    }

    await Promise.all(
      claims.map((claim) =>
        this.repository.update(claim.id, { isCashedOut: true }),
      ),
    );
    return { cashedOutCount: claims.length };
  }
}
