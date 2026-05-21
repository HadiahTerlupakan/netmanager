import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { prisma } from "@/modules/database";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_logs:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);

    const where = { tenantId: (session.user as { tenantId: string }).tenantId };

    const [data, total] = await Promise.all([
      prisma.oltCommandLog.findMany({
        where,
        orderBy: { executedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.oltCommandLog.count({ where }),
    ]);

    return apiSuccess({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("Error fetching command logs:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengambil data";
    return ApiErrors.internalError(msg);
  }
}
