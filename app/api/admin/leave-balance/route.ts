import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { authorize, isAuthError } from "@/lib/authorization-middleware";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance";
const LEAVE_TYPES = [
  "CUTI",
  "SAKIT",
  "IZIN",
  "LAINNYA",
  "TUKAR_LIBUR",
] as const;
type LeaveTypeValue = (typeof LEAVE_TYPES)[number];
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import * as z from "zod";

const leaveBalanceService = new AdminLeaveBalanceRouteService();

/**
 * Validation schema for setting leave quota
 */
const setQuotaSchema = z.object({
  userId: z.uuid({ error: "Invalid user ID" }),
  year: z.number().int().min(2000).max(2100).optional(),
  quotas: z.record(z.enum(LEAVE_TYPES), z.number().int().min(0).max(365)),
});

/**
 * @swagger
 * /api/admin/leave-balance:
 *   get:
 *     summary: Get all leave balances
 *     tags: [Leave Balance]
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req, {
    permissions: ["attendance:read", "attendance:update", "users:read"],
  });
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;
  const { searchParams } = new URL(req.url);
  const year = parseInt(
    searchParams.get("year") || new Date().getFullYear().toString(),
  );
  const userId = searchParams.get("userId");

  try {
    if (userId) {
      const canAccessUser = await leaveBalanceService.canAccessUser(userId, {
        requesterTenantId: session.user.tenantId,
        isSuperAdmin: session.user.isSuperAdmin,
      });
      if (!canAccessUser) {
        return ApiErrors.forbidden(
          "Anda tidak memiliki akses ke data user ini",
        );
      }
    }

    const result = await leaveBalanceService.getBalances({
      year,
      userId,
      access: {
        requesterTenantId: session.user.tenantId,
        isSuperAdmin: session.user.isSuperAdmin,
      },
    });

    return apiSuccess(result);
  } catch (error: unknown) {
    logger.error("Error fetching leave balances:", error);
    return ApiErrors.internalError("Gagal mengambil data saldo cuti");
  }
}

/**
 * @swagger
 * /api/admin/leave-balance:
 *   post:
 *     summary: Set leave quota for a user
 *     tags: [Leave Balance]
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req, {
    permissions: ["attendance:update", "users:update"],
  });
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;

  try {
    const body = await req.json();
    const parseResult = setQuotaSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError("Data tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: z.flattenError(parseResult.error).fieldErrors,
      });
    }

    const { userId, year, quotas } = parseResult.data;
    const canAccessUser = await leaveBalanceService.canAccessUser(userId, {
      requesterTenantId: session.user.tenantId,
      isSuperAdmin: session.user.isSuperAdmin,
    });
    if (!canAccessUser) {
      return ApiErrors.forbidden("Anda tidak diizinkan mengubah data user ini");
    }

    const result = await leaveBalanceService.updateQuota({
      userId,
      year,
      quotas: quotas as Partial<Record<LeaveTypeValue, number>>,
      access: {
        requesterTenantId: session.user.tenantId,
        isSuperAdmin: session.user.isSuperAdmin,
      },
    });

    return apiSuccess(result, { message: "Kuota cuti berhasil diperbarui" });
  } catch (error: unknown) {
    logger.error("Error updating leave quota:", error);
    return ApiErrors.internalError("Gagal memperbarui kuota cuti");
  }
}
