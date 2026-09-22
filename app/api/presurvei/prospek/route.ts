import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  buatProspekSchema,
  daftarProspekSchema,
  ProspekService,
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "../akses-presurvei";

const service = new ProspekService();

/** GET /api/presurvei/prospek — daftar prospek dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest, ctx) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarProspekSchema.parse({
      status: searchParams.get("status") ?? undefined,
      sumber: searchParams.get("sumber") ?? undefined,
      pemilikId: searchParams.get("pemilikId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    // Sales tanpa permission web hanya melihat prospeknya sendiri; filter
    // `pemilikId` yang dikirim klien ditimpa, bukan dipercaya.
    const hasil = await service.daftar(
      isBolehLihatSemuaPresurvei(ctx.permissions)
        ? filters
        : { ...filters, pemilikId: ctx.session!.user.id },
    );

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
