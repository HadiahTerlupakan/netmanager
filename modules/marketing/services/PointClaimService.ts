import { logger } from "@/lib/logger";
import type {
  IPointClaimRepository,
  CreatePointClaimInput,
  PointClaimFilters,
} from "../domain/ports/IPointClaimRepository";
import type {
  PointClaimDashboardSummaryEntity,
  PointClaimEntity,
  PointSummaryEntity,
} from "../domain/entities/PointClaimEntity";
import type { PointClaimDTO, PointClaimListItemDTO } from "../dto/MarketingDTO";
import {
  createNotification,
  notifyNewPointClaim,
} from "@/modules/notification";
import { prisma, prismaMitra } from "@/modules/database";
import { getMitraWalletService } from "@/modules/mitra";
import { MarketingMapper } from "../mappers/MarketingMapper";

const PENDING_STATUS = "PENDING" as const;
const APPROVED_STATUS = "APPROVED" as const;
const REJECTED_STATUS = "REJECTED" as const;
const MITRA_SALES_TYPE = "MITRA_SALES" as const;
const CASHOUT_DEFAULT_TARGET = 30;
const COMPLETED_WORK_ORDER_STATUSES = ["COMPLETED", "VERIFIED", "CLOSED"];

export class PointClaimService {
  constructor(private readonly repository: IPointClaimRepository) {}

  /** Submit a point claim and return a response DTO. */
  async submitClaim(data: CreatePointClaimInput): Promise<PointClaimDTO> {
    const canvasing = await this.requireClaimableCanvasing(data);
    const claim = await this.repository.create(data);
    await this.repository.updateCanvasingLock(data.canvasingId, true);
    this.notifySubmittedClaim(canvasing, claim);
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
    const claim = await this.requirePendingClaim(id);
    const approved = await this.repository.update(id, {
      status: APPROVED_STATUS,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      ...(notes ? { reviewNotes: notes } : {}),
    });
    this.notifyApprovedClaim(claim);
    await this.addMitraCommissionIfEligible(approved, id);
    return MarketingMapper.toPointClaimDTO(approved);
  }

  /** Reject point claim and return a response DTO. */
  async rejectClaim(
    id: string,
    reviewerId: string,
    notes: string,
  ): Promise<PointClaimDTO> {
    const claim = await this.requirePendingClaim(id);
    this.ensureNotes(notes);
    await this.repository.updateCanvasingLock(claim.canvasingId, false);
    this.notifyRejectedClaim(claim, notes, id);
    await this.repository.delete(id);
    return MarketingMapper.toPointClaimDTO(
      this.createRejectedClaim(claim, reviewerId, notes),
    );
  }

  /** Delete a pending point claim. */
  async deleteClaim(id: string): Promise<void> {
    const claim = await this.requireExistingClaim(id);
    if (claim.status === APPROVED_STATUS) {
      throw new Error("Claim yang sudah disetujui tidak bisa dihapus");
    }

    await this.repository.updateCanvasingLock(claim.canvasingId, false);
    await this.repository.delete(id);
  }

  /** Cash out approved accumulated claims for a sales user. */
  async cashoutAccumulatedClaims(userId: string) {
    const user = await this.requireEligibleCashoutUser(userId);
    const target = user.canvasingTarget || CASHOUT_DEFAULT_TARGET;
    const claims = await this.findCashoutEligibleClaims(userId);
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

  /** Require user eligibility before accumulated cashout. */
  private async requireEligibleCashoutUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSales: true, canvasingTarget: true, targetSchema: true },
    });

    if (!user) {
      throw new Error("User tidak ditemukan");
    }

    if (!user.isSales) {
      throw new Error(
        "Hanya akun sales yang dapat mencairkan bonus canvasing.",
      );
    }

    if (user.targetSchema !== "ACCUMULATED") {
      throw new Error(
        "Akun Anda menggunakan skema Target Bulanan. Pencairan dilakukan otomatis di akhir bulan.",
      );
    }

    return user;
  }

  /** Find approved claims that are ready for accumulated cashout. */
  private async findCashoutEligibleClaims(userId: string) {
    const claims = await this.repository.findAll({
      salesId: userId,
      status: APPROVED_STATUS,
    });

    return claims.filter(
      (claim) =>
        !(claim as PointClaimEntity & { isCashedOut?: boolean }).isCashedOut,
    );
  }

  private async requireClaimableCanvasing(data: CreatePointClaimInput) {
    const canvasing = await this.repository.findCanvasingClaimSubmission(
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

  private async requirePendingClaim(id: string): Promise<PointClaimEntity> {
    const claim = await this.requireExistingClaim(id);
    if (claim.status === PENDING_STATUS) {
      return claim;
    }

    throw new Error("Hanya claim dengan status PENDING yang bisa diproses");
  }

  private async requireExistingClaim(id: string): Promise<PointClaimEntity> {
    const claim = await this.repository.findById(id);
    if (claim) {
      return claim;
    }

    throw new Error("Claim tidak ditemukan");
  }

  private ensureNotes(notes: string): void {
    if (notes.trim()) {
      return;
    }

    throw new Error("Alasan penolakan wajib diisi");
  }

  private createRejectedClaim(
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

  private notifySubmittedClaim(
    canvasing: {
      id: string;
      nama: string;
      salesId: string;
      userName: string | null;
      userSiteId: string | null;
    },
    claim: PointClaimEntity,
  ): void {
    notifyNewPointClaim({
      claimId: claim.id,
      canvasingId: canvasing.id,
      customerName: canvasing.nama,
      salesId: canvasing.salesId,
      salesName: canvasing.userName || "Sales",
      pointValue: claim.pointValue,
      siteId: canvasing.userSiteId,
    }).catch((error) => logger.error("[PointClaim Notif] Error:", error));
  }

  private notifyApprovedClaim(claim: PointClaimEntity): void {
    createNotification({
      type: "ANNOUNCEMENT",
      priority: "NORMAL",
      title: "⭐ Claim Poin Disetujui",
      message: `Claim poin +${claim.pointValue} poin berhasil disetujui!`,
      link: `/marketing/canvasing/${claim.canvasingId}`,
      userId: claim.salesId,
      sourceType: "POINT_CLAIM",
      sourceId: claim.id,
    }).catch((error) => logger.error("[PointClaim Notif] Error:", error));
  }

  private notifyRejectedClaim(
    claim: PointClaimEntity,
    notes: string,
    sourceId: string,
  ): void {
    createNotification({
      type: "ANNOUNCEMENT",
      priority: "NORMAL",
      title: "❌ Claim Poin Ditolak",
      message: `Claim poin ditolak. Alasan: ${notes}`,
      link: `/marketing/canvasing/${claim.canvasingId}`,
      userId: claim.salesId,
      sourceType: "POINT_CLAIM",
      sourceId,
    }).catch((error) => logger.error("[PointClaim Notif] Error:", error));
  }

  /** Add mitra commission after claim approval when sales belongs to mitra sales. */
  private async addMitraCommissionIfEligible(
    claim: PointClaimEntity,
    fallbackSourceId: string,
  ) {
    const salesMitra = await prismaMitra.mitra.findUnique({
      where: { id: claim.salesId },
      select: { mitraType: true, mitraRateCanvasing: true },
    });

    if (!salesMitra?.mitraRateCanvasing) {
      return;
    }

    if (salesMitra.mitraType !== MITRA_SALES_TYPE) {
      return;
    }

    const walletService = getMitraWalletService();
    await walletService.addEarning(
      claim.salesId,
      salesMitra.mitraRateCanvasing,
      `Komisi Canvasing #${claim.canvasingId || fallbackSourceId}`,
      claim.canvasingId || fallbackSourceId,
      "CANVASING",
    );
  }
}
