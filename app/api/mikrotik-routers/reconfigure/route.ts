import { prisma } from "@/modules/database";
import {
  MikroTikProvisioningService,
  MikroTikRouterService,
  RouterAccessDeniedError,
} from "@/modules/network";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

// Initialize service
const provisioningService = new MikroTikProvisioningService();
const routerService = new MikroTikRouterService();

function getRouterApiCredentials(router: {
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated?: string | null;
  apiPasswordGenerated?: string | null;
}) {
  return {
    username: router.apiUsernameGenerated || router.apiUsername,
    password: router.apiPasswordGenerated || router.apiPassword,
  };
}

export const POST = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("mikrotik:update"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = await req.json();
  const { routerIds } = body;

  if (!Array.isArray(routerIds) || routerIds.length === 0) {
    return apiError("No routers selected", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  // 1. Fetch Global Settings
  const settings = await prisma.settings.findMany({
    where: {
      key: { in: ["RADIUS_SECRET", "ISOLIR_URL", "MIKROTIK_API_URL"] },
    },
  });

  const radiusSecret =
    settings.find((s) => s.key === "RADIUS_SECRET")?.value || "testing123";
  const isolirUrl = settings.find((s) => s.key === "ISOLIR_URL")?.value;

  // 2. Fetch Selected Routers with authorization
  const user = _ctx.session!.user;
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  let hasDeniedRouter = false;

  const authorizedRouters = await Promise.all(
    routerIds.map(async (routerId) => {
      try {
        const router = await routerService.getRouterById({
          id: routerId,
          tenantId: user.tenantId,
          userId: user.id,
          restrictedToOwnSite,
        });

        return router.pingStatus === "online" ? router : null;
      } catch (error: unknown) {
        if (error instanceof RouterAccessDeniedError) {
          hasDeniedRouter = true;
        }
        return null;
      }
    }),
  );

  if (hasDeniedRouter) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const routers = authorizedRouters.filter(
    (router): router is NonNullable<(typeof authorizedRouters)[number]> =>
      router !== null,
  );

  if (routers.length === 0) {
    return ApiErrors.notFound("No valid routers found among selection");
  }

  const results = [];
  let successCount = 0;

  // 3. Process Each Router
  for (const router of routers) {
    try {
      const { username, password } = getRouterApiCredentials(router);

      const routerDetails = {
        ip: router.ipAddress,
        port: router.apiPort,
        username,
        password,
      };

      const result = await provisioningService.provisionRadius(
        routerDetails,
        null, // Allow auto-detect IP
        radiusSecret,
        isolirUrl,
      );

      results.push({
        id: router.id,
        name: router.name,
        success: result.success,
        logs: result.logs,
        error: result.success ? null : "Provisioning failed",
      });

      if (result.success) successCount++;
    } catch (error: unknown) {
      results.push({
        id: router.id,
        name: router.name,
        success: false,
        logs: [],
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    }
  }

  return apiSuccess({
    success: true,
    message: `Reconfiguration completed. ${successCount}/${routers.length} successful.`,
    results,
  });
});
