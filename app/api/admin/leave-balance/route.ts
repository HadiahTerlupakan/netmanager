import { NextRequest } from "next/server";
import { authorize, isAuthError } from "@/lib/authorization-middleware";
import {
  LeaveBalanceRepository,
  DEFAULT_LEAVE_QUOTAS,
} from "@/modules/attendance";
import { LeaveType } from "@prisma/client";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import * as z from "zod";
import { prismaAuth } from "@/modules/database";

const leaveBalanceRepo = new LeaveBalanceRepository();

/**
 * Validation schema for setting leave quota
 */
const setQuotaSchema = z.object({
  userId: z.uuid({ error: "Invalid user ID" }),
  year: z.number().int().min(2000).max(2100).optional(),
  quotas: z.record(z.enum(LeaveType), z.number().int().min(0).max(365)),
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
      // Security: Verify user belongs to same tenant if not superadmin
      if (!session.user.isSuperAdmin) {
        const targetUser = await prismaAuth.user.findUnique({
          where: { id: userId },
          select: { tenantId: true, email: true },
        });

        // Debug logging for troubleshooting
        if (!targetUser || targetUser.tenantId !== session.user.tenantId) {
          console.warn("[AUTH_DEBUG] Tenant mismatch or user not found:", {
            requesterId: session.user.id,
            requesterTenant: session.user.tenantId,
            targetUserId: userId,
            targetUserEmail: targetUser?.email,
            targetTenant: targetUser?.tenantId,
          });
          return ApiErrors.forbidden(
            "Anda tidak memiliki akses ke data user ini",
          );
        }
      }

      // Get balances for specific user
      const balances = await leaveBalanceRepo.getUserBalances(userId, year);

      // Fill in missing types with defaults
      const allTypes = Object.keys(DEFAULT_LEAVE_QUOTAS) as LeaveType[];

      const filledBalances = allTypes.map((type) => {
        const existing = balances.find((b) => b.leaveType === type);
        if (existing) {
          return {
            ...existing,
            remaining: existing.quota - existing.used,
          };
        }
        return {
          leaveType: type,
          quota: DEFAULT_LEAVE_QUOTAS[type],
          used: 0,
          remaining: DEFAULT_LEAVE_QUOTAS[type],
        };
      });

      return apiSuccess({ balances: filledBalances, year });
    }

    // Get all balances for admin view
    const balances = await leaveBalanceRepo.getAllBalances(year);
    return apiSuccess({ balances, year });
  } catch (error: unknown) {
    console.error("Error fetching leave balances:", error);
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

    // Validate with Zod
    const parseResult = setQuotaSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError("Data tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: z.flattenError(parseResult.error).fieldErrors,
      });
    }

    const { userId, year, quotas } = parseResult.data;

    // Security: Verify user belongs to same tenant if not superadmin
    if (!session.user.isSuperAdmin) {
      const targetUser = await prismaAuth.user.findUnique({
        where: { id: userId },
        select: { tenantId: true },
      });
      if (!targetUser || targetUser.tenantId !== session.user.tenantId) {
        return ApiErrors.forbidden(
          "Anda tidak diizinkan mengubah data user ini",
        );
      }
    }

    const targetYear = year || new Date().getFullYear();

    // Update each provided quota
    const updatePromises = Object.entries(quotas).map(([type, quota]) =>
      leaveBalanceRepo.upsertQuota(
        userId,
        targetYear,
        type as LeaveType,
        quota as number,
      ),
    );

    await Promise.all(updatePromises);

    // Return updated balances
    const balances = await leaveBalanceRepo.getUserBalances(userId, targetYear);
    return apiSuccess(
      { balances },
      { message: "Kuota cuti berhasil diperbarui" },
    );
  } catch (error: unknown) {
    console.error("Error updating leave quota:", error);
    return ApiErrors.internalError("Gagal memperbarui kuota cuti");
  }
}
