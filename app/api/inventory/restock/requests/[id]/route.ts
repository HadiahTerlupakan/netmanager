import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryRouteService,
  getRestockRequestDetail,
  patchRestockRequestLifecycle,
} from "@/modules/inventory";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { restockLifecycleSchema } from "@/lib/validations/restock";
import { handleRestockPutRequest } from "./restock-put.handler";

const inventoryRouteService = getInventoryRouteService();

/** Ambil detail purchase request restock. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const tenantId = session.user.tenantId as string;
  return getRestockRequestDetail(id, tenantId);
}

/** Ubah lifecycle purchase request restock. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:update"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin restock:update" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = restockLifecycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  return patchRestockRequestLifecycle({
    id,
    action: parsed.data.action,
    catatan: parsed.data.catatan,
    actorId: session.user.id as string,
    tenantId: session.user.tenantId as string,
  });
}

/** Perbarui purchase request draft/submitted. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRestockPutRequest(req, id);
}

/** Hapus purchase request restock. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:delete"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin restock:delete" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const tenantId = session.user.tenantId as string;
  const existing = await inventoryRouteService.getPurchaseRequestById({
    id,
    tenantId,
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Pengajuan tidak ditemukan" },
      { status: 404 },
    );
  }

  await inventoryRouteService.deletePurchaseRequest(id);
  return NextResponse.json({ message: "Pengajuan berhasil dihapus" });
}
