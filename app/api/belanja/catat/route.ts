import { logger } from "@/lib/logger";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import {
  describeRestockValidationError,
  publicPurchaseRecordSchema,
  RESTOCK_PURCHASE_RECORD_LIST_LABELS,
} from "@/lib/validations/restock";
import {
  createRestockPublicPurchaseService,
  type PublicPurchaseErrorCode,
} from "@/modules/inventory";

import {
  isLinkCreatorAuthorized,
  getPublicClientInfo,
  linkInactiveResponse,
  publicError,
  publicJson,
  readRateLimitedPublicBody,
  type PublicLinkErrorCode,
} from "../_lib/public-link-http";

export const dynamic = "force-dynamic";

const publicPurchaseService = createRestockPublicPurchaseService();
/**
 * Menulis catatan dan mengunggah tanda tangan tanpa login, jadi ditolak
 * saat Redis bermasalah (fail-closed) daripada berjalan tanpa batas.
 */
const RATE_LIMITS = {
  scope: "belanja:catat",
  perIp: 20,
  perLink: 10,
  isFailClosed: true,
};
const HTTP_CREATED = 201;
const HTTP_OK = 200;

const SUBMIT_ERROR_CODE: Record<PublicPurchaseErrorCode, PublicLinkErrorCode> =
  {
    LINK_INACTIVE: "LINK_INACTIVE",
    INVALID: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  };

/**
 * POST /api/belanja/catat — catat belanja dari link tanpa login, lengkap
 * dengan nama dan tanda tangan pembeli. Kiriman ulang dengan
 * `clientRequestId` yang sama dijawab 200 tanpa mencatat dua kali.
 */
export async function POST(request: Request) {
  const parsed = await readRateLimitedPublicBody(request, RATE_LIMITS);
  if (parsed.ok === false) return parsed.response;

  const input = publicPurchaseRecordSchema.safeParse(parsed.body);
  if (!input.success) {
    return publicError(
      "VALIDATION_ERROR",
      describeRestockValidationError(
        input.error,
        RESTOCK_PURCHASE_RECORD_LIST_LABELS,
      ),
    );
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

    const fields = input.data;
    const result = await runWithRequestTenantContext(
      { tenantId: link.tenantId, isSuperAdmin: false },
      () =>
        publicPurchaseService.submit(
          link,
          {
            clientRequestId: fields.clientRequestId,
            buyerName: fields.buyerName,
            storeName: fields.storeName,
            purchasedAt: fields.purchasedAt,
            notes: fields.notes ?? null,
            signatureDataUrl: fields.signatureDataUrl,
            items: fields.items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? null,
            })),
          },
          getPublicClientInfo(request),
        ),
    );
    if (result.success === false) {
      return result.code === "LINK_INACTIVE"
        ? linkInactiveResponse()
        : publicError(SUBMIT_ERROR_CODE[result.code], result.error);
    }
    return publicJson(
      { data: result.data },
      result.data.isReplay ? HTTP_OK : HTTP_CREATED,
    );
  } catch (error) {
    logger.error(
      "Error recording purchase via link",
      error instanceof Error ? error : new Error(String(error)),
      { linkId },
    );
    return publicError("INTERNAL_ERROR");
  }
}
