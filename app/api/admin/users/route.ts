import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getUserService } from "@/modules/users";
import { createUserSchema } from "@/lib/validations/user";
import { logger } from "@/lib/logger";
import { checkSiteRestriction } from "@/modules/roles";
import { prisma, prismaAuth } from "@/modules/database";
import { getTenantAdminRoleId } from "@/modules/mitra";
import { LeaveType } from "@prisma/client";
import type { Session } from "next-auth";

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     description: Mengambil daftar semua pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["users:read"],
  },
  async (req, ctx) => {
    const startTime = Date.now();
    const { session, permissions } = ctx;

    if (!session) return ApiErrors.unauthorized();

    // Augmented session for site restriction helper
    const sessionWithPermissions = {
      ...session,
      user: {
        ...session.user,
        permissions,
      },
    };

    // Get site and tenant filters
    const { primarySiteId: siteIdFilter } = checkSiteRestriction(
      sessionWithPermissions as Session,
      "users",
    );
    let tenantIdFilter = req.nextUrl.searchParams.get("tenantId") || undefined;
    const roleNameFilter =
      req.nextUrl.searchParams.get("roleName") || undefined;

    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const page = pageParam ? parseInt(pageParam) : undefined;
    const limit = limitParam ? parseInt(limitParam) : undefined;
    const search = req.nextUrl.searchParams.get("search") || undefined;

    const statusParam = req.nextUrl.searchParams.get("status");
    let isActive: boolean | undefined = undefined;
    if (statusParam === "active") isActive = true;
    if (statusParam === "inactive") isActive = false;

    // If session user is NOT super admin, they can ONLY see their own tenant
    // If session user IS super admin but no tenantId provided, default to their current tenant
    if (!session.user.isSuperAdmin) {
      tenantIdFilter = session.user.tenantId || undefined;
    } else if (!tenantIdFilter) {
      tenantIdFilter = session.user.tenantId || undefined;
    }

    const userService = getUserService();
    const result = await userService.getAllUsers({
      siteId: siteIdFilter,
      tenantId: tenantIdFilter,
      roleName: roleNameFilter,
      page,
      limit,
      search,
      isActive,
    });

    logger.apiRequest("GET", "/api/admin/users", 200, Date.now() - startTime, {
      userId: session.user.id,
      count: result.data.length,
      total: result.total,
    });

    return apiSuccess({
      users: result.data,
      meta: {
        total: result.total,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        active: (result as any).active,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inactive: (result as any).inactive,
        page: page || 1,
        limit: limit || result.data.length,
      },
    });
  },
);

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Membuat pengguna baru. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["users:create"],
    schema: createUserSchema,
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, validated: body } = ctx;

    if (!session) return ApiErrors.unauthorized();

    // Site restriction check using centralized helper
    const { isRestricted, primarySiteId: userSiteId } = checkSiteRestriction(
      session as Session,
      "users",
    );

    if (isRestricted) {
      if (!userSiteId) {
        return ApiErrors.forbidden(
          "User restricted to site but has no site assigned.",
        );
      }
      if (body.siteId && body.siteId !== userSiteId) {
        return ApiErrors.forbidden(
          "Anda hanya dapat membuat user untuk site Anda",
        );
      }
      body.siteId = userSiteId;
    }

    // Tenant assignment logic
    // If user is Super Admin, they can specify tenantId in body
    // Otherwise, it will follow the implicit tenant of the user (via prisma extension)
    const isSuperAdmin = session.user.isSuperAdmin || false;
    const targetTenantId = isSuperAdmin ? body.tenantId : undefined;

    // Automatically find admin role for the target tenant if not provided
    let effectiveRoleId = body.roleId;
    if (!effectiveRoleId && targetTenantId) {
      effectiveRoleId =
        (await getTenantAdminRoleId(prismaAuth, targetTenantId)) || undefined;
      if (effectiveRoleId) {
        logger.info("Automatically assigned admin role for new tenant user", {
          tenantId: targetTenantId,
          roleId: effectiveRoleId,
        });
      }
    }

    logger.info("Creating new user", {
      email: body.email,
      createdBy: session.user.id,
      roleId: effectiveRoleId,
    });

    try {
      const userService = getUserService();
      const user = await userService.createUser({
        ...body,
        roleId: effectiveRoleId || body.roleId,
        tenantId: targetTenantId || body.tenantId || null,
        flexibleTargetHour: body.flexibleTargetHour
          ? parseInt(body.flexibleTargetHour.toString())
          : 8,
      });

      // Handle multi-site: create userSites records
      if (
        body.userSites &&
        Array.isArray(body.userSites) &&
        body.userSites.length > 0
      ) {
        await prisma.userSite.createMany({
          data: body.userSites.map((us) => ({
            userId: user.id,
            siteId: us.siteId!,
            isPrimary: us.isPrimary || false,
          })),
        });

        // Update legacy siteId to primary site for backward compatibility
        const primarySite = body.userSites.find((us) => us.isPrimary);
        if (primarySite) {
          await prisma.user.update({
            where: { id: user.id },
            data: { siteId: primarySite.siteId },
          });
        }

        logger.info("UserSites created for new user", {
          userId: user.id,
          count: body.userSites.length,
        });
      }

      // Handle leave quotas initialization
      if (body.leaveQuotas && Object.keys(body.leaveQuotas).length > 0) {
        try {
          const { LeaveBalanceRepository } =
            await import("@/modules/attendance");
          const leaveBalanceRepo = new LeaveBalanceRepository();
          const targetYear = new Date().getFullYear();

          const updatePromises = Object.entries(body.leaveQuotas).map(
            ([type, quota]) =>
              leaveBalanceRepo.upsertQuota(
                user.id,
                targetYear,
                type as LeaveType,
                quota as number,
              ),
          );
          await Promise.all(updatePromises);
          logger.info("Leave quotas initialized for new user", {
            userId: user.id,
          });
        } catch (err: unknown) {
          const leaveQuotaError =
            err instanceof Error ? err : new Error(String(err));
          logger.error(
            "Failed to init leave quotas for new user",
            leaveQuotaError,
            {
              userId: user.id,
            },
          );
        }
      }

      logger.apiRequest(
        "POST",
        "/api/admin/users",
        201,
        Date.now() - startTime,
        {
          userId: session.user.id,
          newUserId: user.id,
        },
      );

      // System Log
      await logger.logActivity({
        action: "CREATE",
        subject: "User",
        userId: session.user.id,
        details: { id: user.id, email: user.email },
      });

      return apiSuccess(
        { id: user.id },
        { status: 201, message: "User berhasil dibuat" },
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith("Email sudah terdaftar")) {
        return ApiErrors.conflict(e.message);
      }
      throw e; // Let createHandler deal with general errors
    }
  },
);
