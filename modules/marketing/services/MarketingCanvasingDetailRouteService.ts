import { ErrorCodes } from "@/lib/api";
import { parseUpdateCanvasingInput } from "../validators/canvasingValidation";
import type { CanvasingDetailDTO } from "../dto/MarketingDTO";
import { createCanvasingService } from "./marketing-service-factories";
import {
  badRequestCanvasing,
  canAccessCanvasingDetailSite,
  canDeleteCanvasingDetail,
  canManageCanvasingApproval,
  canReadCanvasingDetail,
  canUpdateCanvasingDetail,
  CANCEL_APPROVAL_INVALID_STATUS_MESSAGE,
  type CanvasingRoutePolicyInput,
  type CanvasingRouteRepositoryPort,
  forbiddenCanvasing,
  FORBIDDEN_DELETE_MESSAGE,
  FORBIDDEN_UPDATE_MESSAGE,
  FORBIDDEN_VIEW_MESSAGE,
  getForbiddenStatusUpdateMessage,
  hasForbiddenStatusUpdate,
  type MarketingCanvasingDetailRouteResult,
  notFoundCanvasing,
  type UpdateCanvasingRouteInput,
  withValidationMapping,
} from "./marketing-canvasing-detail-route.helpers";

export type { MarketingCanvasingDetailRouteResult } from "./marketing-canvasing-detail-route.helpers";

export class MarketingCanvasingDetailRouteService {
  private canvasingInstance?: CanvasingRouteRepositoryPort;

  constructor(canvasing?: CanvasingRouteRepositoryPort) {
    this.canvasingInstance = canvasing;
  }

  private get canvasing() {
    if (!this.canvasingInstance) {
      this.canvasingInstance = createCanvasingService();
    }

    return this.canvasingInstance;
  }

  /** Ambil detail canvasing setelah policy owner/permission/site terpenuhi. */
  async getDetail(
    input: CanvasingRoutePolicyInput,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    const existing = await this.canvasing.getRequestById(input.id);
    if (!existing) return notFoundCanvasing();

    if (!canReadCanvasingDetail(input, existing)) {
      return forbiddenCanvasing(FORBIDDEN_VIEW_MESSAGE);
    }

    const siteAccess = await this.validateSiteAccess(input);
    if (!siteAccess.success) return forbiddenCanvasing(FORBIDDEN_VIEW_MESSAGE);

    return { success: true, data: existing };
  }

  /** Update detail canvasing setelah policy dan validasi payload terpenuhi. */
  async updateDetail(
    input: UpdateCanvasingRouteInput,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    return withValidationMapping<CanvasingDetailDTO>(async () => {
      const existing = await this.canvasing.getRequestById(input.id);
      if (!existing) return notFoundCanvasing();

      if (!canUpdateCanvasingDetail(input, existing)) {
        return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
      }

      const siteAccess = await this.validateSiteAccess(input);
      if (!siteAccess.success) {
        return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
      }

      if (hasForbiddenStatusUpdate(input.body)) {
        return badRequestCanvasing(getForbiddenStatusUpdateMessage());
      }

      const payload = parseUpdateCanvasingInput(input.body);
      const updated = await this.canvasing.updateRequest(input.id, payload);
      return { success: true, data: updated };
    }, "Gagal memperbarui data canvasing");
  }

  /** Proses patch canvasing termasuk cancel approval. */
  async patchDetail(
    input: UpdateCanvasingRouteInput,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    return withValidationMapping<CanvasingDetailDTO>(async () => {
      const existing = await this.canvasing.getRequestById(input.id);
      if (!existing) return notFoundCanvasing();

      if (input.body.action === "cancel_approval") {
        return this.cancelApproval(input, existing);
      }

      if (!canUpdateCanvasingDetail(input, existing)) {
        return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
      }

      const siteAccess = await this.validateSiteAccess(input);
      if (!siteAccess.success) {
        return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
      }

      if (hasForbiddenStatusUpdate(input.body)) {
        return badRequestCanvasing(getForbiddenStatusUpdateMessage());
      }

      const payload = parseUpdateCanvasingInput(input.body);
      const updated = await this.canvasing.updateRequest(input.id, payload);
      return { success: true, data: updated };
    }, "Gagal memperbarui data canvasing");
  }

  /** Hapus canvasing setelah permission dan site scope terpenuhi. */
  async deleteDetail(
    input: CanvasingRoutePolicyInput,
  ): Promise<MarketingCanvasingDetailRouteResult<null>> {
    try {
      if (!canDeleteCanvasingDetail(input)) {
        return forbiddenCanvasing(FORBIDDEN_DELETE_MESSAGE);
      }

      const existing = await this.canvasing.getRequestById(input.id);
      if (!existing) return notFoundCanvasing();

      const siteAccess = await this.validateSiteAccess(input);
      if (!siteAccess.success) {
        return forbiddenCanvasing(FORBIDDEN_DELETE_MESSAGE);
      }

      await this.canvasing.deleteRequest(input.id);
      return {
        success: true,
        data: null,
        message: "Data canvasing berhasil dihapus",
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghapus data canvasing",
      };
    }
  }

  private async cancelApproval(
    input: UpdateCanvasingRouteInput,
    existing: CanvasingDetailDTO,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    if (!canManageCanvasingApproval(input)) {
      return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
    }

    if (existing.status !== "APPROVED") {
      return {
        success: false,
        status: 400,
        error: CANCEL_APPROVAL_INVALID_STATUS_MESSAGE,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const siteAccess = await this.validateSiteAccess(input);
    if (!siteAccess.success) {
      return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
    }

    const updated = await this.canvasing.cancelApproval(input.id);
    return {
      success: true,
      data: updated,
      message: "Approval berhasil dibatalkan",
    };
  }

  private async validateSiteAccess(input: CanvasingRoutePolicyInput) {
    const requestWithSales = await this.canvasing.getRequestByIdWithSales(
      input.id,
    );
    if (!requestWithSales) {
      return notFoundCanvasing();
    }

    if (!canAccessCanvasingDetailSite(input, requestWithSales)) {
      return forbiddenCanvasing(FORBIDDEN_UPDATE_MESSAGE);
    }

    return { success: true as const };
  }
}

export const marketingCanvasingDetailRouteService =
  new MarketingCanvasingDetailRouteService();
