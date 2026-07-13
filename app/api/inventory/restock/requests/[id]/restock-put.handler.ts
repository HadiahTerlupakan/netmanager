import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getInventoryRouteService } from "@/modules/inventory";
import { restockUpdateSchema } from "@/lib/validations/restock";

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

  const body = await req.json();
  const parsed = restockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { items, jasaItems, gudangId, keterangan } = parsed.data;
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
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
