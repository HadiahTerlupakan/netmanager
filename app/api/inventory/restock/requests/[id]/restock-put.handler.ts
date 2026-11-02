import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  getInventoryRouteService,
  isRestockMissingReferenceError,
  RESTOCK_MESSAGES,
  restockCannotEditMessage,
  restockForbiddenMessage,
  restockServerErrorMessage,
} from "@/modules/inventory";
import {
  describeRestockValidationError,
  restockUpdateSchema,
} from "@/lib/validations/restock";
import {
  ensureRestockGudangSiteAccess,
  ensureRestockRequestSiteAccess,
} from "../../_lib/restock-site-access";

const inventoryRouteService = getInventoryRouteService();

interface RestockItemInput {
  barangId: string;
  quantity?: number;
  jumlah?: number;
  keterangan?: string | null;
}

interface RestockJasaItemInput {
  jasaId: string;
  jumlah?: number;
  hargaPerUnit?: number;
  keterangan?: string | null;
}

export async function handleRestockPutRequest(req: NextRequest, id: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.sessionExpired },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:update"))) {
    return NextResponse.json(
      { error: restockForbiddenMessage("restock:update") },
      { status: 403 },
    );
  }

  const body = await req.json().catch((): null => null);
  if (!body) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.unreadableBody },
      { status: 400 },
    );
  }
  const parsed = restockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: describeRestockValidationError(parsed.error) },
      { status: 400 },
    );
  }

  const { items, jasaItems, gudangId, keterangan } = parsed.data;
  const tenantId = session.user.tenantId as string;
  const siteDenied =
    (await ensureRestockRequestSiteAccess({
      user: session.user,
      purchaseRequestId: id,
      tenantId,
    })) ??
    (await ensureRestockGudangSiteAccess({ user: session.user, gudangId }));
  if (siteDenied) return siteDenied;
  const existing = await inventoryRouteService.getPurchaseRequestById({
    id,
    tenantId,
  });

  if (!existing) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.requestNotFound },
      { status: 404 },
    );
  }

  if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: restockCannotEditMessage(existing.status) },
      { status: 400 },
    );
  }

  try {
    const result = await inventoryRouteService.updatePurchaseRequest({
      id,
      tenantId,
      actorId: session.user.id as string,
      gudangId,
      keterangan,
      items: (items || []).map((item: RestockItemInput) => ({
        barangId: item.barangId,
        quantity: item.quantity || item.jumlah || 0,
        keterangan: item.keterangan || null,
      })),
      jasaItems: (jasaItems || []).map((item: RestockJasaItemInput) => ({
        jasaId: item.jasaId,
        jumlah: item.jumlah || 1,
        hargaPerUnit: item.hargaPerUnit || 0,
        keterangan: item.keterangan || null,
      })),
    });

    return NextResponse.json({
      data: result,
      message: "Pengajuan berhasil diperbarui",
    });
  } catch (error: unknown) {
    if (isRestockMissingReferenceError(error)) {
      return NextResponse.json(
        { error: RESTOCK_MESSAGES.missingReference },
        { status: 400 },
      );
    }
    logger.error(
      "Error updating purchase request",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: id },
    );
    return NextResponse.json(
      // Item lama dihapus dan item baru ditulis dalam satu transaksi.
      {
        error: restockServerErrorMessage("Menyimpan perubahan pengajuan", true),
      },
      { status: 500 },
    );
  }
}
