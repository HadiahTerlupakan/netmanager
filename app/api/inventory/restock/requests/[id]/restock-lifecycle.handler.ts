import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockValidationError,
  restockLifecycleSchema,
} from "@/lib/validations/restock";
import {
  patchRestockRequestLifecycle,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type RestockLifecycleErrorCode,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../_lib/restock-site-access";

const LIFECYCLE_ERROR_STATUS: Record<RestockLifecycleErrorCode, number> = {
  INVALID: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/** Setujui (per baris) atau tolak pengajuan restock — PATCH /restock/requests/[id]. */
export async function handleRestockLifecycleRequest(
  req: NextRequest,
  id: string,
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.sessionExpired },
      { status: 401 },
    );
  }
  if (!(await hasPermission("restock:approve"))) {
    return NextResponse.json(
      { error: restockForbiddenMessage("restock:approve") },
      { status: 403 },
    );
  }

  const tenantId = session.user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user: session.user,
    purchaseRequestId: id,
    tenantId,
  });
  if (siteDenied) return siteDenied;

  const body = await req.json().catch((): null => null);
  if (!body) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.unreadableBody },
      { status: 400 },
    );
  }
  const parsed = restockLifecycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: describeRestockValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await patchRestockRequestLifecycle({
      ...parsed.data,
      id,
      tenantId,
      actorId: session.user.id as string,
    });
    if (result.success === false) {
      return NextResponse.json(
        { error: result.error },
        { status: LIFECYCLE_ERROR_STATUS[result.code] },
      );
    }
    return NextResponse.json(result.data);
  } catch (error: unknown) {
    logger.error(
      "Error updating purchase request",
      error instanceof Error ? error : new Error(String(error)),
      { path: "/api/inventory/restock/requests/[id]", method: "PATCH" },
    );
    // Keputusan disimpan dalam satu transaksi, tetapi PO dibuat sesudahnya,
    // jadi jangan menjanjikan bahwa tidak ada yang berubah.
    return NextResponse.json(
      { error: restockServerErrorMessage("Memproses pengajuan", false) },
      { status: 500 },
    );
  }
}
