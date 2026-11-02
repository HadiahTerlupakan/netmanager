import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkSiteRestriction } from "@/lib/authorization/site-restriction";
import { hasPermission } from "@/lib/rbac";
import {
  createRestockRequest,
  getInventoryRouteService,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
} from "@/modules/inventory";
import {
  describeRestockValidationError,
  restockCreateSchema,
} from "@/lib/validations/restock";
import { ensureRestockGudangSiteAccess } from "../_lib/restock-site-access";

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

const inventoryRouteService = getInventoryRouteService();

/** Ambil daftar purchase request restock. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.sessionExpired },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:read"))) {
    return NextResponse.json(
      { error: restockForbiddenMessage("restock:read") },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const { isRestricted, siteIds } = checkSiteRestriction(session, "restock");
  const result = await inventoryRouteService.getPurchaseRequests({
    tenantId: session.user.tenantId as string,
    status,
    ...(isRestricted ? { siteIds } : {}),
  });

  return NextResponse.json(result);
}

/** Buat purchase request restock baru. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.sessionExpired },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:create"))) {
    return NextResponse.json(
      { error: restockForbiddenMessage("restock:create") },
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
  const parsed = restockCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: describeRestockValidationError(parsed.error) },
      { status: 400 },
    );
  }

  const { items, jasaItems, gudangId, keterangan } = parsed.data;
  const gudangDenied = await ensureRestockGudangSiteAccess({
    user: session.user,
    gudangId,
  });
  if (gudangDenied) return gudangDenied;

  return createRestockRequest({
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
    gudangId,
    keterangan,
    requesterId: session.user.id as string,
    tenantId: session.user.tenantId as string,
    apiPath: "/api/inventory/restock/requests",
  });
}
