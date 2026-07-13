import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createRestockRequest,
  getInventoryRouteService,
} from "@/modules/inventory";
import { restockCreateSchema } from "@/lib/validations/restock";

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
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:read"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin restock:read" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const result = await inventoryRouteService.getPurchaseRequests({
    tenantId: session.user.tenantId as string,
    status,
  });

  return NextResponse.json(result);
}

/** Buat purchase request restock baru. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:create"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin restock:create" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = restockCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { items, jasaItems, gudangId, keterangan } = parsed.data;

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
