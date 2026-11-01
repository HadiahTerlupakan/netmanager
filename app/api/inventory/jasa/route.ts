import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  describeZodIssues,
  getJasaService,
  PESAN_BELUM_MASUK,
  PESAN_DATA_TIDAK_TERBACA,
  pesanGagalMuat,
  pesanTanpaIzin,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { masterDataFailureResponse } from "../master-data-response";
import { jasaCreateSchema } from "@/lib/validations/jasa";
import { parsePaginationParams } from "@/lib/constants/pagination";

/** Ambil daftar master jasa. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: PESAN_BELUM_MASUK }, { status: 401 });
  }

  if (!(await hasPermission("jasa:read"))) {
    return NextResponse.json(
      { error: pesanTanpaIzin("melihat daftar jasa") },
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

  try {
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
  } catch (error: unknown) {
    logger.error("Daftar jasa gagal dimuat", error as Error);
    return NextResponse.json(
      { error: pesanGagalMuat("jasa") },
      { status: 500 },
    );
  }
}

/** Buat master jasa baru. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: PESAN_BELUM_MASUK }, { status: 401 });
  }

  if (!(await hasPermission("jasa:create"))) {
    return NextResponse.json(
      { error: pesanTanpaIzin("menambah jasa") },
      { status: 403 },
    );
  }

  const body = await req.json().catch((): null => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: PESAN_DATA_TIDAK_TERBACA },
      { status: 400 },
    );
  }
  const parsed = jasaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return masterDataFailureResponse(describeZodIssues(parsed.error));
  }

  const result = await getJasaService().create({
    userId: session.user.id as string,
    tenantId: (session.user.tenantId as string) ?? null,
    body: parsed.data,
  });

  if (result.success === false) {
    return masterDataFailureResponse(result);
  }

  return NextResponse.json(result.data, { status: 201 });
}
