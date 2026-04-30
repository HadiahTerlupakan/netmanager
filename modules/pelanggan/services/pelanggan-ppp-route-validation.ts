import * as z from "zod";
import {
  ensureTenantId,
  normalizePagination,
  parseDateRange,
  parseUsagePeriod,
  type UsageSummaryInput,
} from "./pelanggan-ppp-route-helpers";

export const suspendRequestSchema = z.object({
  suspensionType: z.enum(["PAYMENT", "VIOLATION", "MAINTENANCE", "REQUEST"]),
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
  notes: z.string().max(1000, "Notes too long").optional(),
  expectedResumeAt: z.iso.datetime().optional(),
  terminateActiveSessions: z.boolean().default(true),
});

export const activateRequestSchema = z.object({
  notes: z.string().max(1000, "Notes too long").optional(),
  activationMethod: z
    .enum(["MANUAL", "AUTOMATIC", "PAYMENT_CONFIRMED"])
    .optional(),
  syncToRadius: z.boolean().default(true),
});

export class RouteServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "RouteServiceError";
  }
}

export function normalizeRoutePagination(page: number, limit: number) {
  try {
    return normalizePagination(page, limit);
  } catch (error) {
    throwRouteValidationError(error, "Parameter paginasi tidak valid");
  }
}

export function parseRouteUsagePeriod(input: UsageSummaryInput) {
  try {
    return parseUsagePeriod(input);
  } catch (error) {
    throwRouteValidationError(error, "Parameter periode tidak valid");
  }
}

export function parseRouteDateRange(
  startDate?: string | null,
  endDate?: string | null,
) {
  try {
    return parseDateRange(startDate, endDate);
  } catch (error) {
    throwRouteValidationError(error, "Format tanggal tidak valid");
  }
}

export function ensureRouteTenantId(tenantId: string | null) {
  try {
    return ensureTenantId(tenantId);
  } catch (error) {
    throwRouteValidationError(error, "Customer tenant not found");
  }
}

function throwRouteValidationError(
  error: unknown,
  fallbackMessage: string,
): never {
  throw new RouteServiceError(
    error instanceof Error ? error.message : fallbackMessage,
    400,
  );
}
