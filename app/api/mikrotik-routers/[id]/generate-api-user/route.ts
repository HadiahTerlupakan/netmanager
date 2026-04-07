import { NextResponse } from "next/server";
import { MikroTikRouterRepository } from "@/modules/network";
import { prisma } from "@/modules/database";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:update"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId;
  const routerRepository = new MikroTikRouterRepository();
  const router = await routerRepository.findById(id, tenantId);

  if (!router) {
    return ApiErrors.notFound("Router tidak ditemukan");
  }

  // Check site restriction
  const user = ctx.session!.user;
  if (
    (await hasPermission("mikrotik:site_only")) &&
    user.role !== "SUPER_ADMIN"
  ) {
    const { prisma: db } = await import("@/modules/database");
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { siteId: true },
    });
    const userSiteId = dbUser?.siteId;
    if (!userSiteId || router.siteId !== userSiteId) {
      return ApiErrors.forbidden("Akses ditolak");
    }
  }

  // Import the provisioning service
  const { MikroTikProvisioningService } = await import("@/modules/network");
  const provisioningService = new MikroTikProvisioningService();

  // console.log(`[Generate API User] Creating API user for router ${router.name} (${router.ipAddress})...`)

  // Create API user using master credentials
  const result = await provisioningService.createApiUser({
    ip: router.ipAddress,
    port: router.apiPort,
    username: router.apiUsername,
    password: router.apiPassword,
  });

  if (!result.success) {
    console.error(`[Generate API User] Failed: ${result.logs.join(", ")}`);
    return NextResponse.json(
      {
        error: "Gagal membuat API user",
        logs: result.logs,
      },
      { status: 500 },
    );
  }

  // Save generated credentials to database
  await prisma.mikroTikRouter.update({
    where: { id: router.id },
    data: {
      ...(result.username && { apiUsernameGenerated: result.username }),
      ...(result.password && { apiPasswordGenerated: result.password }),
    },
  });

  // console.log(`[Generate API User] Success: ${result.username}`)

  // System Log
  try {
    const { logger } = await import("@/lib/logger");
    await logger.logActivity({
      action: "CREATE",
      subject: "MikroTik API User",
      userId: user.id,
      details: { routerId: id, username: result.username },
    });
  } catch (e) {
    console.error("Logging failed", e);
  }

  return apiSuccess({
    success: true,
    username: result.username,
    logs: result.logs,
  });
});
