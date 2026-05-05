import { ZodError } from "zod";
import { ErrorCodes, type ErrorCode } from "@/lib/api";
import { canAccessCanvasingSite } from "./CanvasingSiteAccessService";
import {
  GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
  getCanvasingValidationMessage,
  hasGenericStatusUpdate,
} from "../validators/canvasingValidation";
import type { CanvasingEntity } from "../domain/entities/CanvasingEntity";
import type { CanvasingDetailDTO } from "../dto/MarketingDTO";

export const CANVASING_NOT_FOUND = "Data canvasing";
export const FORBIDDEN_VIEW_MESSAGE =
  "Anda tidak memiliki akses untuk melihat data ini";
export const FORBIDDEN_UPDATE_MESSAGE =
  "Anda tidak memiliki akses untuk mengubah data ini";
export const FORBIDDEN_DELETE_MESSAGE =
  "Anda tidak memiliki akses untuk menghapus data ini";
export const CANCEL_APPROVAL_INVALID_STATUS_MESSAGE =
  "Hanya canvasing dengan status APPROVED yang bisa dibatalkan";

export interface CanvasingRouteSession {
  id: string;
  role?: string | null;
  siteId?: string | null;
}

export interface CanvasingRoutePolicyInput {
  id: string;
  session: CanvasingRouteSession;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface UpdateCanvasingRouteInput extends CanvasingRoutePolicyInput {
  body: Record<string, unknown>;
}

export interface CanvasingRouteRepositoryPort {
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

export function canReadCanvasingDetail(
  input: CanvasingRoutePolicyInput,
  request: CanvasingDetailDTO,
) {
  return (
    input.isSuperAdmin ||
    isCanvasingOwner(input, request) ||
    input.permissions.includes("canvasing:read") ||
    input.permissions.includes("canvasing:verify")
  );
}

export function canUpdateCanvasingDetail(
  input: CanvasingRoutePolicyInput,
  request: CanvasingDetailDTO,
) {
  return (
    input.isSuperAdmin ||
    isCanvasingOwner(input, request) ||
    input.permissions.includes("canvasing:update")
  );
}

export function canManageCanvasingApproval(input: CanvasingRoutePolicyInput) {
  return input.isSuperAdmin || input.permissions.includes("canvasing:update");
}

export function canDeleteCanvasingDetail(input: CanvasingRoutePolicyInput) {
  return input.isSuperAdmin || input.permissions.includes("canvasing:delete");
}

export function canAccessCanvasingDetailSite(
  input: CanvasingRoutePolicyInput,
  request: CanvasingEntity,
) {
  return canAccessCanvasingSite({
    isSuperAdmin: input.isSuperAdmin,
    permissions: input.permissions,
    session: input.session,
    canvasing: request,
  });
}

export function hasForbiddenStatusUpdate(body: Record<string, unknown>) {
  return hasGenericStatusUpdate(body);
}

export function getForbiddenStatusUpdateMessage() {
  return GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE;
}

export async function withValidationMapping<T>(
  action: () => Promise<MarketingCanvasingDetailRouteResult<T>>,
  fallback: string,
): Promise<MarketingCanvasingDetailRouteResult<T>> {
  try {
    return await action();
  } catch (error) {
    return mapCanvasingRouteError(error, fallback);
  }
}

export function mapCanvasingRouteError(
  error: unknown,
  fallback: string,
): MarketingCanvasingDetailRouteResult<never> {
  if (error instanceof ZodError) {
    return badRequestCanvasing(getCanvasingValidationMessage(error));
  }

  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("tidak ditemukan")) {
    return notFoundCanvasing();
  }

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

export function notFoundCanvasing(): MarketingCanvasingDetailRouteResult<never> {
  return { success: false, status: 404, error: CANVASING_NOT_FOUND };
}

export function forbiddenCanvasing(
  error: string,
): MarketingCanvasingDetailRouteResult<never> {
  return { success: false, status: 403, error };
}

export function badRequestCanvasing(
  error: string,
): MarketingCanvasingDetailRouteResult<never> {
  return { success: false, status: 400, error };
}

function isCanvasingOwner(
  input: CanvasingRoutePolicyInput,
  request: CanvasingDetailDTO,
) {
  return request.salesId === input.session.id;
}
