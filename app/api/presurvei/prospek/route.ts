import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  buatProspekSchema,
  daftarProspekSchema,
  ProspekService,
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei";

const service = new ProspekService();

/** GET /api/presurvei/prospek — daftar prospek dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarProspekSchema.parse({
      status: searchParams.get("status") ?? undefined,
      sumber: searchParams.get("sumber") ?? undefined,
      pemilikId: searchParams.get("pemilikId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const hasil = await service.daftar(filters);

    return apiPaginated(hasil.items.map(toProspekListItem), {
      page: filters.page,
      limit: filters.limit,
      total: hasil.total,
    });
  },
);

/** POST /api/presurvei/prospek — catat prospek baru secara manual. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:create", "m_presurvei:create"],
    schema: buatProspekSchema,
  },
  async (_request, ctx) => {
    const prospek = await service.buat({
      ...ctx.validated,
      pemilikId: ctx.validated.pemilikId ?? ctx.session!.user.id,
    });

    return apiSuccess(toProspekDetail(prospek), { status: 201 });
  },
);
