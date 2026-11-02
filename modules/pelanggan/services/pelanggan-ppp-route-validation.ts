import * as z from "zod";
import {
  ensureTenantId,
  normalizePagination,
  parseDateRange,
  parseUsagePeriod,
  type UsageSummaryInput,
} from "./pelanggan-ppp-route-helpers";
import {
  canAccessPelangganBySite,
  getTenantScopedWhereById,
} from "./pelanggan-admin-mutation.helpers";
import type { AdminMutationSession } from "./PelangganAdminMutationService";
import { hasAnyScopeRestriction } from "@/lib/authorization/scope-restriction-permissions";

/**
 * Layar Pelanggan PPP menawarkan toggle `ppp:site_only`, tetapi backend-nya
 * hanya membaca `pelanggan:site_only` — toggle itu tidak menggigit dan role
 * ber-`ppp:site_only` melihat pelanggan seluruh site. Keduanya kini membatasi.
 */
export const PELANGGAN_PPP_SITE_ONLY_PERMISSIONS = [
  "pelanggan:site_only",
  "ppp:site_only",
] as const;

/**
 * Permission sesi untuk route `/api/pelanggan-ppp/**`: bila salah satu toggle
 * pembatas aktif, `pelanggan:site_only` ditambahkan supaya seluruh penjaga
 * hilir (`checkSiteRestriction`/`canAccessSite` dengan resource "pelanggan")
 * ikut membatasi.
 */
export function withPelangganPppSiteScope(permissions: string[]): string[] {
  if (permissions.includes("pelanggan:site_only")) return permissions;
  return hasAnyScopeRestriction(
    permissions,
    PELANGGAN_PPP_SITE_ONLY_PERMISSIONS,
  )
    ? [...permissions, "pelanggan:site_only"]
    : permissions;
}

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

/**
 * Tenant yang membatasi lookup dan update pelanggan untuk sesi route, atau
 * undefined bagi super admin tanpa tenant sesi — aturan yang sama dengan
 * edit/hapus pelanggan (`getTenantScopedWhereById`). Sesi lain tanpa tenant
 * ditolak 403 alih-alih dibiarkan menjadi query tanpa batas tenant.
 */
export function resolveRouteTenantScope(
  session: AdminMutationSession,
  id: string,
): string | undefined {
  try {
    const scope = getTenantScopedWhereById(session, id);
    return "tenantId" in scope ? scope.tenantId : undefined;
  } catch (error) {
    throw new RouteServiceError(
      error instanceof Error ? error.message : "Akses ditolak",
      403,
    );
  }
}

/**
 * Tolak 403 bila sesi dibatasi `pelanggan:site_only` dan pelanggan ada di site
 * lain — pemeriksaan yang sama dengan edit/hapus pelanggan. Sesi wajib
 * membawa `user.permissions` (lihat `buildSessionWithPermissions`); tanpa itu
 * pembatasan site tidak terbaca dan semua site lolos.
 */
export function assertRouteSiteAccess(
  session: AdminMutationSession,
  siteId: string | null | undefined,
) {
  if (!canAccessPelangganBySite(session, siteId)) {
    throw new RouteServiceError("Akses ditolak", 403);
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
