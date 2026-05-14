import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryRouteService,
  getRestockRequestDetail,
  patchRestockRequestLifecycle,
} from "@/modules/inventory";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  restockLifecycleSchema,
  restockUpdateSchema,
} from "@/lib/validations/restock";

interface RestockItemInput {
  barangId: string;
  quantity?: number;
  jumlah?: number;
  keterangan?: string | null;
}

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
  return getRestockRequestDetail(id);
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
  });
}

/** Perbarui purchase request draft/submitted. */
export async function PUT(
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
  const parsed = restockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { items, gudangId, keterangan } = parsed.data;
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

  if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Hanya pengajuan Draft/Submitted yang bisa diubah" },
      { status: 400 },
    );
  }

  try {
    const result = await inventoryRouteService.updatePurchaseRequest({
      id,
      tenantId,
      gudangId,
      keterangan,
      items: items.map((item: RestockItemInput) => ({
        barangId: item.barangId,
        quantity: item.quantity || item.jumlah || 0,
        keterangan: item.keterangan || null,
      })),
    });

    return NextResponse.json({
      data: result,
      message: "Pengajuan berhasil diperbarui",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
