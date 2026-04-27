import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/modules/database";
import { createRestockRequest } from "@/modules/inventory";
import { PurchaseRequestStatus } from "@prisma/client";

interface RestockItemInput {
  barangId: string;
  quantity?: number;
  jumlah?: number;
  keterangan?: string | null;
}

// GET: List all requests
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

  const tenantId = session.user.tenantId as string;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      tenantId,
      ...(status && { status: status as PurchaseRequestStatus }),
    },
    include: {
      items: {
        include: { barang: true },
      },
      requester: { select: { name: true } },
      approver: { select: { name: true } },
      gudang: { select: { nama: true, id: true } },
      purchaseOrder: {
        include: {
          items: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Map receivedQuantity from PO to PR items for the UI
  const data = requests.map((pr) => ({
    ...pr,
    items: pr.items.map((item) => {
      const poItem = pr.purchaseOrder?.items.find(
        (poi) => poi.barangId === item.barangId,
      );
      return {
        ...item,
        receivedQuantity: poItem?.receivedQuantity || 0,
      };
    }),
  }));

  return NextResponse.json({ data });
}

// POST: Create new request
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
  const { items, gudangId, keterangan } = body;

  return createRestockRequest({
    items: items.map((item: RestockItemInput) => ({
      barangId: item.barangId,
      quantity: item.quantity || item.jumlah || 0,
      keterangan: item.keterangan || null,
    })),
    gudangId,
    keterangan,
    requesterId: session.user.id as string,
    tenantId: session.user.tenantId as string,
    apiPath: "/api/inventory/restock/requests",
  });
}
