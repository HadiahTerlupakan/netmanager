import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OnuDiscoveryService } from "@/modules/olt";
import { prisma } from "@/modules/database";

const discoveryService = new OnuDiscoveryService();

function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return ApiErrors.unauthorized("Invalid cron secret");
  }

  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    const results: Record<string, unknown> = {};

    for (const tenant of tenants) {
      const result = await discoveryService.discoverAll(tenant.id);
      if (result.success) {
        results[tenant.id] = result.data;
      }
    }

    logger.info(`[Cron:OltDiscovery] Completed for ${tenants.length} tenants`);
    return apiSuccess({ timestamp: new Date().toISOString(), results });
  } catch (error) {
    logger.error("[Cron:OltDiscovery] Failed:", error);
    const msg =
      error instanceof Error ? error.message : "Discovery cron failed";
    return ApiErrors.internalError(msg);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
