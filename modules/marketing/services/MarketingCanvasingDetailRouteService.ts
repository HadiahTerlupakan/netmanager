import { ZodError } from "zod";
import { ErrorCodes, type ErrorCode } from "@/lib/api";
import type { CanvasingEntity } from "../domain/entities/CanvasingEntity";
import type { CanvasingDetailDTO } from "../dto/MarketingDTO";
import {
  GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
  getCanvasingValidationMessage,
  hasGenericStatusUpdate,
  parseUpdateCanvasingInput,
} from "../validators/canvasingValidation";
import { createCanvasingService } from "..";

const CANVASING_NOT_FOUND = "Data canvasing";
const FORBIDDEN_VIEW_MESSAGE =
  "Anda tidak memiliki akses untuk melihat data ini";
const FORBIDDEN_UPDATE_MESSAGE =
  "Anda tidak memiliki akses untuk mengubah data ini";
const FORBIDDEN_DELETE_MESSAGE =
  "Anda tidak memiliki akses untuk menghapus data ini";
const CANCEL_APPROVAL_INVALID_STATUS_MESSAGE =
  "Hanya canvasing dengan status APPROVED yang bisa dibatalkan";

interface CanvasingRouteSession {
  id: string;
  role?: string | null;
  siteId?: string | null;
}

interface CanvasingRoutePolicyInput {
  id: string;
  session: CanvasingRouteSession;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface UpdateCanvasingRouteInput extends CanvasingRoutePolicyInput {
  body: Record<string, unknown>;
}

interface CanvasingRouteRepositoryPort {
  getRequestById(id: string): Promise<CanvasingDetailDTO | null>;
  getRequestByIdWithSales(id: string): Promise<CanvasingEntity | null>;
  updateRequest(id: string, payload: unknown): Promise<CanvasingDetailDTO>;
  cancelApproval(id: string): Promise<CanvasingDetailDTO>;
  deleteRequest(id: string): Promise<void>;
}

export type MarketingCanvasingDetailRouteResult<T> =
  | { success: true; data: T; message?: string }
  | {
      success: false;
      status: number;
      error: string;
      code?: ErrorCode;
    };

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
    if (!existing) return this.notFound();

    if (!this.canRead(input, existing)) {
      return this.forbidden(FORBIDDEN_VIEW_MESSAGE);
    }

    const siteAccess = await this.validateSiteAccess(input);
    if (!siteAccess.success) return this.forbidden(FORBIDDEN_VIEW_MESSAGE);

    return { success: true, data: existing };
  }

  /** Update detail canvasing setelah policy dan validasi payload terpenuhi. */
  async updateDetail(
    input: UpdateCanvasingRouteInput,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    return this.withValidationMapping<CanvasingDetailDTO>(async () => {
      const existing = await this.canvasing.getRequestById(input.id);
      if (!existing) return this.notFound();

      if (!this.canUpdate(input, existing)) {
        return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);
      }

      const siteAccess = await this.validateSiteAccess(input);
      if (!siteAccess.success) return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);
      if (hasGenericStatusUpdate(input.body)) {
        return this.badRequest(GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE);
      }

      const payload = parseUpdateCanvasingInput(input.body);
      const updated = await this.canvasing.updateRequest(input.id, payload);
      return { success: true, data: updated };
    });
  }

  /** Proses patch canvasing termasuk cancel approval. */
  async patchDetail(
    input: UpdateCanvasingRouteInput,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    return this.withValidationMapping<CanvasingDetailDTO>(async () => {
      const existing = await this.canvasing.getRequestById(input.id);
      if (!existing) return this.notFound();

      if (input.body.action === "cancel_approval") {
        return this.cancelApproval(input, existing);
      }

      if (!this.canUpdate(input, existing)) {
        return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);
      }

      const siteAccess = await this.validateSiteAccess(input);
      if (!siteAccess.success) return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);
      if (hasGenericStatusUpdate(input.body)) {
        return this.badRequest(GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE);
      }

      const payload = parseUpdateCanvasingInput(input.body);
      const updated = await this.canvasing.updateRequest(input.id, payload);
      return { success: true, data: updated };
    });
  }

  /** Hapus canvasing setelah permission dan site scope terpenuhi. */
  async deleteDetail(
    input: CanvasingRoutePolicyInput,
  ): Promise<MarketingCanvasingDetailRouteResult<null>> {
    try {
      if (!this.canDelete(input))
        return this.forbidden(FORBIDDEN_DELETE_MESSAGE);

      const existing = await this.canvasing.getRequestById(input.id);
      if (!existing) return this.notFound();

      const siteAccess = await this.validateSiteAccess(input);
      if (!siteAccess.success) return this.forbidden(FORBIDDEN_DELETE_MESSAGE);

      await this.canvasing.deleteRequest(input.id);
      return {
        success: true,
        data: null,
        message: "Data canvasing berhasil dihapus",
      };
    } catch (error) {
      return this.mapServiceError(error, "Gagal menghapus data canvasing");
    }
  }

  private async cancelApproval(
    input: UpdateCanvasingRouteInput,
    existing: CanvasingDetailDTO,
  ): Promise<MarketingCanvasingDetailRouteResult<CanvasingDetailDTO>> {
    if (!this.canManageApproval(input)) {
      return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);
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
    if (!siteAccess.success) return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);

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
    if (!requestWithSales) return this.notFound();
    if (!this.canAccessSite(input, requestWithSales)) {
      return this.forbidden(FORBIDDEN_UPDATE_MESSAGE);
    }

    return { success: true as const };
  }

  private canRead(
    input: CanvasingRoutePolicyInput,
    request: CanvasingDetailDTO,
  ) {
    return (
      input.isSuperAdmin ||
      this.isOwner(input, request) ||
      input.permissions.includes("canvasing:read") ||
      input.permissions.includes("canvasing:verify")
    );
  }

  private canUpdate(
    input: CanvasingRoutePolicyInput,
    request: CanvasingDetailDTO,
  ) {
    return (
      input.isSuperAdmin ||
      this.isOwner(input, request) ||
      input.permissions.includes("canvasing:update")
    );
  }

  private canManageApproval(input: CanvasingRoutePolicyInput) {
    return input.isSuperAdmin || input.permissions.includes("canvasing:update");
  }

  private canDelete(input: CanvasingRoutePolicyInput) {
    return input.isSuperAdmin || input.permissions.includes("canvasing:delete");
  }

  private canAccessSite(
    input: CanvasingRoutePolicyInput,
    request: CanvasingEntity,
  ) {
    if (
      input.isSuperAdmin ||
      !input.permissions.includes("canvasing:site_only")
    ) {
      return true;
    }

    return this.getCanvasingSiteIds(request).includes(
      input.session.siteId ?? "",
    );
  }

  private getCanvasingSiteIds(request: CanvasingEntity) {
    return [request.user?.siteId, request.mitra?.siteId].filter(
      (siteId): siteId is string => Boolean(siteId),
    );
  }

  private isOwner(
    input: CanvasingRoutePolicyInput,
    request: CanvasingDetailDTO,
  ) {
    return request.salesId === input.session.id;
  }

  private async withValidationMapping<T>(
    action: () => Promise<MarketingCanvasingDetailRouteResult<T>>,
  ): Promise<MarketingCanvasingDetailRouteResult<T>> {
    try {
      return await action();
    } catch (error) {
      return this.mapServiceError(error, "Gagal memperbarui data canvasing");
    }
  }

  private mapServiceError(
    error: unknown,
    fallback: string,
  ): MarketingCanvasingDetailRouteResult<never> {
    if (error instanceof ZodError) {
      return this.badRequest(getCanvasingValidationMessage(error));
    }

    const message = error instanceof Error ? error.message : fallback;
    if (message.includes("tidak ditemukan")) return this.notFound();
    if (message.includes("APPROVED") || message.includes("PENDING")) {
      return {
        success: false,
        status: 400,
        error: message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    return { success: false, status: 500, error: message };
  }

  private notFound(): MarketingCanvasingDetailRouteResult<never> {
    return { success: false, status: 404, error: CANVASING_NOT_FOUND };
  }

  private forbidden(error: string): MarketingCanvasingDetailRouteResult<never> {
    return { success: false, status: 403, error };
  }

  private badRequest(
    error: string,
  ): MarketingCanvasingDetailRouteResult<never> {
    return { success: false, status: 400, error };
  }
}

export const marketingCanvasingDetailRouteService =
  new MarketingCanvasingDetailRouteService();
