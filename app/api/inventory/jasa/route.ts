import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getJasaService } from "@/modules/inventory";
import { jasaCreateSchema } from "@/lib/validations/jasa";
import { parsePaginationParams } from "@/lib/constants/pagination";

/** Ambil daftar master jasa. */
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const supplierId = searchParams.get("supplierId") ?? undefined;
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 50,
  });

  const result = await getJasaService().list({
    tenantId: (session.user.tenantId as string) ?? null,
    search,
    status,
    supplierId,
    page,
    limit,
  });

  return NextResponse.json({
    data: { items: result.items, pagination: result },
  });
}

/** Buat master jasa baru. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  if (!(await hasPermission("barang:create"))) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin barang:create" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = jasaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const result = await getJasaService().create({
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

  return NextResponse.json(result.data, { status: 201 });
}
