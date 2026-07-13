import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getJasaService } from "@/modules/inventory";
import { jasaUpdateSchema } from "@/lib/validations/jasa";

/** Ambil detail jasa. */
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

  if (!(await hasPermission("barang:read"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin barang:read" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const result = await getJasaService().getById(
    id,
    (session.user.tenantId as string) ?? null,
  );

  if (result.success === false) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ data: result.data });
}

/** Perbarui jasa. */
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

  if (!(await hasPermission("barang:update"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin barang:update" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = jasaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const result = await getJasaService().update({
    id,
    userId: session.user.id as string,
    tenantId: (session.user.tenantId as string) ?? null,
    body: parsed.data,
  });

  if (result.success === false) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}

/** Nonaktifkan jasa (soft delete). */
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

  if (!(await hasPermission("barang:delete"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin barang:delete" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const result = await getJasaService().softDelete(
    id,
    session.user.id as string,
    (session.user.tenantId as string) ?? null,
  );

  if (result.success === false) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
