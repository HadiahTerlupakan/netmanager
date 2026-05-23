import type { PointSummaryEntity } from "../domain/entities/PointClaimEntity";
import type { PointClaimDTO, PointClaimListItemDTO } from "../dto/MarketingDTO";
import type { PointClaimFilters } from "../domain/ports/IPointClaimRepository";
import { createPointClaimService } from "./marketing-service-factories";
import type { PointClaimService } from "./PointClaimService";
import {
  badRequestClaim,
  canDeletePointClaim,
  canManagePointClaim,
  canReadAllPointClaims,
  forbiddenClaim,
  FORBIDDEN_DELETE_CLAIM_MESSAGE,
  FORBIDDEN_MANAGE_CLAIM_MESSAGE,
  FORBIDDEN_VIEW_CLAIM_MESSAGE,
  INVALID_ACTION_MESSAGE,
  isPointClaimOwner,
  mapPointClaimRouteError,
  notFoundClaim,
  type PointClaimByCanvasingResult,
  type PointClaimByCanvasingRouteInput,
  type PointClaimDeleteResult,
  type PointClaimDetailResult,
  type PointClaimDetailRouteInput,
  type PointClaimListResult,
  type PointClaimListRouteInput,
  type PointClaimReviewRouteInput,
  type PointClaimRouteResult,
  type PointClaimSubmitRouteInput,
  type PointClaimSummaryResult,
  type PointClaimSummaryRouteInput,
  REJECT_NOTES_REQUIRED_MESSAGE,
} from "./marketing-point-claim-route.helpers";

export type {
  PointClaimByCanvasingResult,
  PointClaimDeleteResult,
  PointClaimDetailResult,
  PointClaimListResult,
  PointClaimRouteResult,
  PointClaimSummaryResult,
} from "./marketing-point-claim-route.helpers";

export type PointClaimCashoutResult = PointClaimRouteResult<{
  cashedOutCount: number;
}>;

/**
 * Route service untuk endpoint point-claim — menangani policy, error mapping,
 * dan delegasi ke PointClaimService. Membuat route handler tetap thin
 * controller, sejalan dengan MarketingCanvasingDetailRouteService.
 */
export class MarketingPointClaimRouteService {
  private serviceInstance?: PointClaimService;

  constructor(service?: PointClaimService) {
    this.serviceInstance = service;
  }

  private get service() {
    if (!this.serviceInstance) {
      this.serviceInstance = createPointClaimService();
    }
    return this.serviceInstance;
  }

  /** Submit claim setelah validasi kepemilikan canvasing dilakukan service. */
  async submit(
    input: PointClaimSubmitRouteInput,
  ): Promise<PointClaimDetailResult> {
    try {
      const claim = await this.service.submitClaim({
        canvasingId: input.canvasingId,
        salesId: input.session.id,
        buktiUrls: input.buktiUrls,
        buktiMetadata: input.buktiMetadata,
        keterangan: input.keterangan,
      });
      return {
        success: true,
        data: claim,
        status: 201,
        message: "Claim poin berhasil diajukan",
      };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal mengajukan claim poin");
    }
  }

  /** List claim — non-admin di-restrict ke salesId sendiri. */
  async list(input: PointClaimListRouteInput): Promise<PointClaimListResult> {
    try {
      const filters: PointClaimFilters = {};
      if (input.status) filters.status = input.status;

      const canReadAll = canReadAllPointClaims(input);
      filters.salesId = canReadAll
        ? (input.salesId ?? undefined)
        : input.session.id;

      const claims: PointClaimListItemDTO[] =
        await this.service.getAllClaims(filters);
      return { success: true, data: claims };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal mengambil data claims");
    }
  }

  /** Detail claim — admin atau pemilik claim saja. */
  async getDetail(
    input: PointClaimDetailRouteInput,
  ): Promise<PointClaimDetailResult> {
    try {
      const claim = await this.service.getClaimById(input.id);
      if (!claim) return notFoundClaim();

      const isAdmin = canReadAllPointClaims(input);
      const isOwner = isPointClaimOwner(input, claim);
      if (!isAdmin && !isOwner) {
        return forbiddenClaim(FORBIDDEN_VIEW_CLAIM_MESSAGE);
      }

      return { success: true, data: claim };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal mengambil data claim");
    }
  }

  /** Approve atau reject claim sesuai action. */
  async review(
    input: PointClaimReviewRouteInput,
  ): Promise<PointClaimDetailResult> {
    if (!canManagePointClaim(input)) {
      return forbiddenClaim(FORBIDDEN_MANAGE_CLAIM_MESSAGE);
    }

    if (input.action === "approve") {
      try {
        const result = await this.service.approveClaim(
          input.id,
          input.session.id,
          input.notes,
        );
        return {
          success: true,
          data: result,
          message: "Claim berhasil di-approve",
        };
      } catch (error) {
        return mapPointClaimRouteError(error, "Gagal memproses claim");
      }
    }

    if (input.action === "reject") {
      if (!input.notes || !input.notes.trim()) {
        return badRequestClaim(REJECT_NOTES_REQUIRED_MESSAGE);
      }

      try {
        const result = await this.service.rejectClaim(
          input.id,
          input.session.id,
          input.notes,
        );
        return {
          success: true,
          data: result,
          message: "Claim berhasil di-reject",
        };
      } catch (error) {
        return mapPointClaimRouteError(error, "Gagal memproses claim");
      }
    }

    return badRequestClaim(INVALID_ACTION_MESSAGE);
  }

  /** Hapus claim (admin only). */
  async delete(
    input: PointClaimDetailRouteInput,
  ): Promise<PointClaimDeleteResult> {
    if (!canDeletePointClaim(input)) {
      return forbiddenClaim(FORBIDDEN_DELETE_CLAIM_MESSAGE);
    }

    try {
      await this.service.deleteClaim(input.id);
      return {
        success: true,
        data: null,
        message: "Claim berhasil dihapus",
      };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal menghapus claim");
    }
  }

  /** Ambil summary poin untuk sales user — non-admin selalu lihat dirinya. */
  async getSummary(
    input: PointClaimSummaryRouteInput,
  ): Promise<PointClaimSummaryResult> {
    try {
      const targetSalesId =
        input.isSuperAdmin && input.salesId ? input.salesId : input.session.id;
      const summary: PointSummaryEntity =
        await this.service.getPointSummary(targetSalesId);
      return { success: true, data: summary };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal mengambil summary points");
    }
  }

  /** Ambil claim berdasarkan canvasing — return null bila belum ada claim. */
  async getByCanvasing(
    input: PointClaimByCanvasingRouteInput,
  ): Promise<PointClaimByCanvasingResult> {
    try {
      const claim: PointClaimDTO | null =
        await this.service.getClaimByCanvasingId(input.canvasingId);
      return { success: true, data: { claim } };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal mengambil data claim");
    }
  }

  /** Cashout claim akumulatif untuk sales user yang sedang login. */
  async cashout(input: {
    session: { id: string };
  }): Promise<PointClaimCashoutResult> {
    try {
      const result = await this.service.cashoutAccumulatedClaims(
        input.session.id,
      );
      return {
        success: true,
        data: result,
        message: `Berhasil mencairkan ${result.cashedOutCount} poin canvasing.`,
      };
    } catch (error) {
      return mapPointClaimRouteError(error, "Gagal mencairkan bonus canvasing");
    }
  }
}

export const marketingPointClaimRouteService =
  new MarketingPointClaimRouteService();
