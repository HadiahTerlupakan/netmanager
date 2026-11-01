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
import { masterDataFailureResponse } from "../../master-data-response";
import { jasaUpdateSchema } from "@/lib/validations/jasa";

/** Ambil detail jasa. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  let result: Awaited<ReturnType<ReturnType<typeof getJasaService>["getById"]>>;
  try {
    result = await getJasaService().getById(
      id,
      (session.user.tenantId as string) ?? null,
    );
  } catch (error: unknown) {
    logger.error("Detail jasa gagal dimuat", error as Error);
    return NextResponse.json(
      { error: pesanGagalMuat("jasa") },
      { status: 500 },
    );
  }

  if (result.success === false) {
    return masterDataFailureResponse(result);
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
    return NextResponse.json({ error: PESAN_BELUM_MASUK }, { status: 401 });
  }

  if (!(await hasPermission("jasa:update"))) {
    return NextResponse.json(
      { error: pesanTanpaIzin("mengubah jasa") },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await req.json().catch((): null => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: PESAN_DATA_TIDAK_TERBACA },
      { status: 400 },
    );
  }
  const parsed = jasaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return masterDataFailureResponse(describeZodIssues(parsed.error));
  }

  const result = await getJasaService().update({
    id,
    userId: session.user.id as string,
    tenantId: (session.user.tenantId as string) ?? null,
    body: parsed.data,
  });

  if (result.success === false) {
    return masterDataFailureResponse(result);
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
    return NextResponse.json({ error: PESAN_BELUM_MASUK }, { status: 401 });
  }

  if (!(await hasPermission("jasa:delete"))) {
    return NextResponse.json(
      { error: pesanTanpaIzin("menonaktifkan jasa") },
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
    return masterDataFailureResponse(result);
  }

  return NextResponse.json(result.data);
}
