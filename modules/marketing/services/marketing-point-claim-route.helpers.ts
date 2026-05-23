import { ErrorCodes, type ErrorCode } from "@/lib/api";
import {
  isMarketingError,
  type MarketingErrorKind,
} from "../domain/errors/MarketingError";
import type { PointClaimDTO, PointClaimListItemDTO } from "../dto/MarketingDTO";
import type {
  PointClaimDashboardSummaryEntity,
  PointSummaryEntity,
} from "../domain/entities/PointClaimEntity";

export const POINT_CLAIM_NOT_FOUND = "Claim";
export const FORBIDDEN_VIEW_CLAIM_MESSAGE =
  "Anda tidak memiliki akses ke claim ini";
export const FORBIDDEN_MANAGE_CLAIM_MESSAGE =
  "Anda tidak memiliki akses untuk mengelola claim";
export const FORBIDDEN_DELETE_CLAIM_MESSAGE =
  "Anda tidak memiliki akses untuk menghapus claim";
export const REJECT_NOTES_REQUIRED_MESSAGE = "Alasan penolakan wajib diisi";
export const INVALID_ACTION_MESSAGE =
  "Action tidak valid. Gunakan approve atau reject";

export interface PointClaimRouteSession {
  id: string;
  role?: string | null;
  permissions?: string[];
}

export interface PointClaimRoutePolicyInput {
  session: PointClaimRouteSession;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface PointClaimDetailRouteInput extends PointClaimRoutePolicyInput {
  id: string;
}

export interface PointClaimReviewRouteInput extends PointClaimDetailRouteInput {
  action: "approve" | "reject";
  notes?: string;
}

export interface PointClaimSubmitRouteInput extends PointClaimRoutePolicyInput {
  canvasingId: string;
  buktiUrls: string[];
  buktiMetadata?: Record<string, unknown>;
  keterangan?: string;
}

export interface PointClaimListRouteInput extends PointClaimRoutePolicyInput {
  status?: string;
  salesId?: string;
}

export interface PointClaimSummaryRouteInput extends PointClaimRoutePolicyInput {
  salesId?: string;
}

export interface PointClaimByCanvasingRouteInput extends PointClaimRoutePolicyInput {
  canvasingId: string;
}

export type PointClaimRouteResult<T> =
  | { success: true; data: T; message?: string; status?: number }
  | {
      success: false;
      status: number;
      error: string;
      code?: ErrorCode;
    };

export type PointClaimRouteFailure = Extract<
  PointClaimRouteResult<unknown>,
  { success: false }
>;

export function isPointClaimRouteFailure<T>(
  result: PointClaimRouteResult<T>,
): result is PointClaimRouteFailure {
  return !result.success;
}

export type PointClaimDetailResult = PointClaimRouteResult<PointClaimDTO>;
export type PointClaimListResult = PointClaimRouteResult<
  PointClaimListItemDTO[]
>;
export type PointClaimSummaryResult = PointClaimRouteResult<PointSummaryEntity>;
export type PointClaimDashboardResult =
  PointClaimRouteResult<PointClaimDashboardSummaryEntity>;
export type PointClaimByCanvasingResult = PointClaimRouteResult<{
  claim: PointClaimDTO | null;
}>;
export type PointClaimDeleteResult = PointClaimRouteResult<null>;

export function canReadAllPointClaims(input: PointClaimRoutePolicyInput) {
  return (
    input.isSuperAdmin ||
    input.permissions.includes("canvasing:read") ||
    input.permissions.includes("point_claims:read")
  );
}

export function canManagePointClaim(input: PointClaimRoutePolicyInput) {
  return (
    input.isSuperAdmin ||
    input.permissions.includes("point_claims:update") ||
    input.permissions.includes("canvasing:update") ||
    input.permissions.includes("marketing:update")
  );
}

export function canDeletePointClaim(input: PointClaimRoutePolicyInput) {
  return (
    input.isSuperAdmin || input.permissions.includes("point_claims:delete")
  );
}

export function isPointClaimOwner(
  input: PointClaimRoutePolicyInput,
  claim: PointClaimDTO,
) {
  return claim.salesId === input.session.id;
}

export function notFoundClaim(): PointClaimRouteResult<never> {
  return { success: false, status: 404, error: POINT_CLAIM_NOT_FOUND };
}

export function forbiddenClaim(error: string): PointClaimRouteResult<never> {
  return { success: false, status: 403, error };
}

export function badRequestClaim(error: string): PointClaimRouteResult<never> {
  return {
    success: false,
    status: 400,
    error,
    code: ErrorCodes.VALIDATION_ERROR,
  };
}

export function mapPointClaimRouteError(
  error: unknown,
  fallback: string,
): PointClaimRouteResult<never> {
  if (isMarketingError(error)) {
    return mapMarketingErrorByKind(error.kind, error.message);
  }

  const message = error instanceof Error ? error.message : fallback;
  return { success: false, status: 500, error: message };
}

function mapMarketingErrorByKind(
  kind: MarketingErrorKind,
  message: string,
): PointClaimRouteResult<never> {
  if (kind === "not_found") {
    return notFoundClaim();
  }
  if (kind === "forbidden") {
    return { success: false, status: 403, error: message };
  }
  if (kind === "invalid_status" || kind === "validation") {
    return badRequestClaim(message);
  }
  return { success: false, status: 500, error: message };
}
