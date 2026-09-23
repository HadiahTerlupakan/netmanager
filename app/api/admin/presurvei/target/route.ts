import type { NextRequest } from "next/server";
import {
  apiSuccess,
  createHandler,
  requireSessionTenantIdUnlessSuperAdmin,
} from "@/lib/api";
import {
  laporanPeriodeSchema,
  TargetService,
  tetapkanTargetSchema,
  toTargetDto,
} from "@/modules/presurvei";

const service = new TargetService();

/** GET /api/admin/presurvei/target — target seluruh sales pada satu periode. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_target:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const periode = laporanPeriodeSchema.parse({
      tahun: searchParams.get("tahun") ?? undefined,
      bulan: searchParams.get("bulan") ?? undefined,
    });

    const target = await service.ambilPeriode(periode);

    return apiSuccess(target.map(toTargetDto));
  },
);

/** POST /api/admin/presurvei/target — tetapkan target seorang sales. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei_target:create"],
    schema: tetapkanTargetSchema,
  },
  async (_request, ctx) => {
    // Tenant baris HANYA dari sesi. Super admin tanpa tenant sesi tidak
    // ditolak: service memakai tenant milik sales itu dan menulisnya
    // eksplisit, sambil memastikan `userId` memang sales se-tenant.
    const target = await service.tetapkan(
      ctx.validated,
      requireSessionTenantIdUnlessSuperAdmin(ctx),
    );
    return apiSuccess(toTargetDto(target), { status: 201 });
  },
);
