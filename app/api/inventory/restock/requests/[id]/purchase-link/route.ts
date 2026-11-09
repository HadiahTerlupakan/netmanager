import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import type { HandlerContext } from "@/lib/api/handler";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  buildPurchaseLinkUrl,
  createRestockPurchaseLinkService,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type PurchaseLinkSummary,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const purchaseLinkService = createRestockPurchaseLinkService();
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

type LinkRouteContext = HandlerContext<unknown>;

function serializeLink(link: PurchaseLinkSummary) {
  return {
    id: link.id,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt.toISOString(),
    lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
    createdByName: link.createdByName,
  };
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Izin `restock:verify` + lingkup site; null bila boleh lanjut. */
async function guardLinkAccess(
  ctx: LinkRouteContext,
): Promise<NextResponse | null> {
  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }
  return ensureRestockRequestSiteAccess({
    user: ctx.session!.user,
    purchaseRequestId: ctx.params.id,
    tenantId: ctx.session!.user.tenantId as string,
  });
}

function logRouteError(action: string, error: unknown, id: string): void {
  logger.error(
    `Error ${action} restock purchase link`,
    error instanceof Error ? error : new Error(String(error)),
    { purchaseRequestId: id },
  );
}

/** Status link belanja pengajuan. Tidak pernah memuat URL maupun token. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = await guardLinkAccess(ctx);
  if (denied) return withNoStore(denied);
  try {
    const result = await purchaseLinkService.getStatus(
      ctx.params.id,
      ctx.session!.user.tenantId as string,
    );
    if (result.success === false) {
      return withNoStore(ApiErrors.notFound(result.error));
    }
    return NextResponse.json(
      {
        data: {
          link: result.data.link ? serializeLink(result.data.link) : null,
          availability: result.data.availability,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logRouteError("reading", error, ctx.params.id);
    return withNoStore(
      ApiErrors.internalError(
        restockServerErrorMessage("Membuka link belanja", false),
      ),
    );
  }
});

/** Buat link belanja baru; link lama langsung mati. URL hanya dikirim sekali. */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = await guardLinkAccess(ctx);
  if (denied) return withNoStore(denied);
  try {
    const result = await purchaseLinkService.create(
      ctx.params.id,
      ctx.session!.user.tenantId as string,
      ctx.session!.user.id as string,
    );
    if (result.success === false) {
      return withNoStore(
        result.code === "NOT_FOUND"
          ? ApiErrors.notFound(result.error)
          : ApiErrors.conflict(result.error),
      );
    }
    return NextResponse.json(
      {
        data: {
          link: serializeLink(result.data.link),
          url: buildPurchaseLinkUrl(result.data.token),
        },
      },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logRouteError("creating", error, ctx.params.id);
    return withNoStore(
      ApiErrors.internalError(
        restockServerErrorMessage("Membuat link belanja", false),
      ),
    );
  }
});

/** Matikan link belanja aktif pengajuan. */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = await guardLinkAccess(ctx);
  if (denied) return withNoStore(denied);
  try {
    const result = await purchaseLinkService.revoke(
      ctx.params.id,
      ctx.session!.user.tenantId as string,
      ctx.session!.user.id as string,
    );
    if (result.success === false) {
      return withNoStore(ApiErrors.notFound(result.error));
    }
    return NextResponse.json(
      { data: { revoked: result.data.revoked } },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logRouteError("revoking", error, ctx.params.id);
    return withNoStore(
      ApiErrors.internalError(
        restockServerErrorMessage("Mematikan link belanja", false),
      ),
    );
  }
});
