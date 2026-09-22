import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  buatIklanSchema,
  daftarIklanSchema,
  IklanService,
  toIklanDetail,
  toIklanListItem,
} from "@/modules/presurvei";

const service = new IklanService();

/** GET /api/admin/presurvei/iklan — daftar iklan dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_iklan:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarIklanSchema.parse({
      channel: searchParams.get("channel") ?? undefined,
      isAktif: searchParams.get("isAktif") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const hasil = await service.daftar(filters);

    return apiPaginated(hasil.items.map(toIklanListItem), {
      page: filters.page,
      limit: filters.limit,
      total: hasil.total,
    });
  },
);

/** POST /api/admin/presurvei/iklan — catat kampanye iklan baru. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei_iklan:create"],
    schema: buatIklanSchema,
  },
  async (_request, ctx) => {
    const iklan = await service.buat(ctx.validated);
    return apiSuccess(toIklanDetail(iklan), { status: 201 });
  },
);
