import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { TenantDomainService } from "@/modules/tenant";
import { logger } from "@/lib/logger";

const domainService = new TenantDomainService();

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
    const verifyResults = await domainService.verifyPendingDomains();
    const activeResults = await domainService.checkActiveDomains();
    await domainService.checkSslProvisioning();

    const summary = {
      timestamp: new Date().toISOString(),
      pending: {
        checked: verifyResults.length,
        verified: verifyResults.filter((r) => r.verified).length,
      },
      active: {
        checked: activeResults.length,
        failed: activeResults.filter((r) => !r.stillActive).length,
      },
    };

    logger.info("[Cron:TenantDomainVerify]", summary);
    return apiSuccess(summary);
  } catch (error) {
    logger.error("[Cron:TenantDomainVerify] Failed:", error);
    const msg =
      error instanceof Error ? error.message : "Domain verify cron failed";
    return ApiErrors.internalError(msg);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
