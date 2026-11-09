import { logger } from "@/lib/logger";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { publicPurchaseListSchema } from "@/lib/validations/restock";
import { createRestockPublicPurchaseService } from "@/modules/inventory";

import {
  isLinkCreatorAuthorized,
  linkInactiveResponse,
  publicError,
  publicJson,
  readRateLimitedPublicBody,
} from "../_lib/public-link-http";

export const dynamic = "force-dynamic";

const publicPurchaseService = createRestockPublicPurchaseService();
/** Hanya membaca: tetap jalan saat Redis bermasalah (fail-open). */
const RATE_LIMITS = {
  scope: "belanja:daftar",
  perIp: 60,
  perLink: 30,
  isFailClosed: false,
};

/**
 * POST /api/belanja/daftar — daftar belanja untuk pemegang link tanpa login.
 *
 * Memakai POST karena token dibawa di body JSON (bukan di path, query, atau
 * header) supaya tidak tercatat di log mana pun. Tanpa efek samping selain
 * `lastUsedAt` yang dibatasi.
 */
export async function POST(request: Request) {
  const parsed = await readRateLimitedPublicBody(request, RATE_LIMITS);
  if (parsed.ok === false) return parsed.response;
  if (!publicPurchaseListSchema.safeParse(parsed.body).success) {
    return publicError("VALIDATION_ERROR");
  }

  let linkId: string | null = null;
  try {
    const link = await runAsSystemContext(
      "belanja: cari link",
      () => publicPurchaseService.resolveLink(parsed.token),
      { silent: true },
    );
    if (!link || !(await isLinkCreatorAuthorized(link.createdById))) {
      return linkInactiveResponse();
    }
    linkId = link.id;

    const result = await runWithRequestTenantContext(
      { tenantId: link.tenantId, isSuperAdmin: false },
      () => publicPurchaseService.getList(link),
    );
    if (result.success === false) return linkInactiveResponse();
    return publicJson({ data: result.data }, 200);
  } catch (error) {
    logger.error(
      "Error reading public purchase list",
      error instanceof Error ? error : new Error(String(error)),
      { linkId },
    );
    return publicError("INTERNAL_ERROR");
  }
}
