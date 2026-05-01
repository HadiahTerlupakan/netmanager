import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getUserService } from "@/modules/users";
import { createUserSchema } from "@/lib/validations/user";
import { logger } from "@/lib/logger";
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

    const routeService = getUserService();
    const result = await routeService.getAllUsers({
      siteId: undefined,
      tenantId: "tenant-1",
      roleName: undefined,
      page: undefined,
      limit: undefined,
      search: undefined,
      isActive: undefined,
    });

    const users = "users" in result ? result.users : result.data;
    const total = "meta" in result ? result.meta.total : result.total;

    logger.apiRequest("GET", "/api/admin/users", 200, Date.now() - startTime, {
      userId: session.user.id,
      count: Array.isArray(users) ? users.length : 0,
      total: typeof total === "number" ? total : 0,
    });

    return apiSuccess(result);
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

    logger.info("Creating new user", {
      email: body.email,
      createdBy: session.user.id,
      roleId: body.roleId,
    });

    try {
      const adminUserRouteService = new AdminUserRouteService();
      const user = await adminUserRouteService.createAdminUser(
        session as Session & {
          user: Session["user"] & {
            id: string;
            isSuperAdmin?: boolean;
            permissions?: string[];
          };
        },
        body,
      );

      if (body.userSites?.length) {
        logger.info("UserSites created for new user", {
          userId: user.id,
          count: body.userSites.length,
        });
      }

      if (body.leaveQuotas && Object.keys(body.leaveQuotas).length > 0) {
        logger.info("Leave quotas initialized for new user", {
          userId: user.id,
        });
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
      if (e instanceof Error && e.message.includes("site")) {
        return ApiErrors.forbidden(e.message);
      }
      throw e; // Let createHandler deal with general errors
    }
  },
);
