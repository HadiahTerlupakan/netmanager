import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockStatus,
  getInventoryRouteService,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
  restockServerErrorMessage,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const inventoryRouteService = getInventoryRouteService();

/** Setujui purchase request restock. */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;
  const tenantId = session.user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user: session.user,
    purchaseRequestId: id,
    tenantId: session.user.tenantId as string,
  });
  if (siteDenied) return siteDenied;
  const request = await inventoryRouteService.getPurchaseRequestById({
    id,
    tenantId,
  });

  if (!request) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.requestNotFound },
      { status: 404 },
    );
  }

  if (request.status !== "DRAFT" && request.status !== "SUBMITTED") {
    return NextResponse.json(
      {
        error: `Pengajuan ini ${describeRestockStatus(request.status)}, jadi tidak perlu disetujui lagi. Muat ulang halaman untuk melihat keadaan terbarunya.`,
      },
      { status: 400 },
    );
  }

  try {
    const updated = await inventoryRouteService.approvePurchaseRequest({
      id,
      approverId: session.user.id as string,
    });

    return NextResponse.json({
      data: updated,
      message: "Pengajuan berhasil disetujui",
    });
  } catch (error) {
    logger.error("Error approving purchase request", error as Error);
    return NextResponse.json(
      { error: restockServerErrorMessage("Menyetujui pengajuan", false) },
      { status: 500 },
    );
  }
}
