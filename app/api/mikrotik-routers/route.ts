import { MikroTikRouterRepository } from "@/modules/network";
import { mikrotikRouterCreateSchema } from "@/lib/validations/mikrotik";
import { hasPermission } from "@/lib/rbac";
import type { MikroTikRouterCreateData } from "@/modules/network";
import { logActivitySafe } from "@/lib/logger";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { prisma } from "@/modules/database";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || undefined;

  if (!(await hasPermission("mikrotik:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const routerRepository = new MikroTikRouterRepository();
  const user = ctx.session!.user;

  // RBAC: Check site restrictions
  let siteIdFilter: string | undefined = undefined;
  const isRestricted =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  if (isRestricted) {
    // Fetch user siteId
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { siteId: true },
    });
    const userSiteId = dbUser?.siteId;

    if (!userSiteId) {
      return apiSuccess({
        routers: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }
    siteIdFilter = userSiteId;
  }

  const tenantId = ctx.session!.user.tenantId;
  const filters: Record<string, string | undefined> = {};
  if (search) filters.search = search;
  if (siteIdFilter) filters.siteId = siteIdFilter;

  const result = await routerRepository.findWithFilters(
    filters,
    { page, limit },
    tenantId,
  );

  return apiSuccess(result);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = await req.json();
  const parsed = mikrotikRouterCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Data tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const user = ctx.session!.user;
  const {
    name,
    ipAddress,
    timezone,
    apiPort,
    apiUsername,
    apiPassword,
    isolirUrl,
    description,
    siteId,
  } = parsed.data;

  // RBAC: Check site restrictions for creation
  let finalSiteId = siteId;
  const isRestricted =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  if (isRestricted) {
    // Fetch user siteId
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { siteId: true },
    });
    const userSiteId = dbUser?.siteId;

    if (!userSiteId) {
      return ApiErrors.forbidden(
        "User tidak memiliki akses site untuk membuat router",
      );
    }
    finalSiteId = userSiteId;
  }

  // Memaksa semua konfigurasi RADIUS dari environment agar konsisten
  const forceSecretRadius = process.env.RADIUS_SECRET || "testing123";
  const forceAuthPort = Number(process.env.RADIUS_AUTH_PORT) || 1812;
  const forceAcctPort = Number(process.env.RADIUS_ACCT_PORT) || 1813;

  try {
    const routerRepository = new MikroTikRouterRepository();
    const createData: Record<string, string | number | undefined> = {
      name,
      ipAddress,
      apiPort: Number(apiPort),
      apiUsername,
      apiPassword,
      authPort: forceAuthPort,
      accountingPort: forceAcctPort,
      secretRadius: forceSecretRadius,
    };
    if (timezone) createData.timezone = timezone;
    if (isolirUrl) createData.isolirUrl = isolirUrl;
    if (description) createData.description = description;
    if (finalSiteId) createData.siteId = finalSiteId;
    createData.tenantId = user.tenantId;

    const router = await routerRepository.create(
      createData as unknown as MikroTikRouterCreateData,
    );

    // Auto Provisioning
    if (body.autoConfigure) {
      // console.log('Starting Auto Provisioning...');
      try {
        const serviceModule = await import("@/modules/network");
        if (serviceModule && serviceModule.MikroTikProvisioningService) {
          const { MikroTikProvisioningService } = serviceModule;
          const provisioningService = new MikroTikProvisioningService();

          const provisioningResult = await provisioningService.provisionRadius(
            {
              ip: ipAddress,
              port: Number(apiPort),
              username: apiUsername,
              password: apiPassword,
            },
            null, // auto-detect IP publik
            forceSecretRadius,
            isolirUrl,
            forceAuthPort,
            forceAcctPort,
          );

          if (!provisioningResult.success) {
            console.warn(
              `Router created but provisioning failed: ${provisioningResult.logs.join(", ")}`,
            );
          }

          // console.log('Creating API User...');
          const apiUserResult = await provisioningService.createApiUser({
            ip: ipAddress,
            port: Number(apiPort),
            username: apiUsername,
            password: apiPassword,
          });

          if (
            apiUserResult.success &&
            apiUserResult.username &&
            apiUserResult.password
          ) {
            await prisma.mikroTikRouter.update({
              where: { id: router.id },
              data: {
                apiUsernameGenerated: apiUserResult.username,
                apiPasswordGenerated: apiUserResult.password,
              },
            });
            // console.log(`API User created and saved: ${apiUserResult.username}`);
          } else {
            console.warn(
              `API User creation failed: ${apiUserResult.logs.join(", ")}`,
            );
          }
        }
      } catch (e: unknown) {
        console.error("Provisioning CRITICAL error:", e);
      }
    }

    try {
      const { checkSingleMikroTikRouterStatus } =
        await import("@/modules/network");
      await checkSingleMikroTikRouterStatus(router.id);
    } catch (err) {
      console.error("Failed to perform initial router check:", err);
    }

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "MikroTik Router",
      userId: user.id,
      details: { id: router.id, name: name, ip: ipAddress },
    });

    return apiSuccess({ id: router.id }, { status: 201 });
  } catch (_e: unknown) {
    return apiError(
      "IP Address sudah terpakai atau terjadi kesalahan",
      ErrorCodes.CONFLICT,
      { status: 409 },
    );
  }
});
