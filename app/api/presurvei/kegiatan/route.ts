import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  catatKegiatanSchema,
  daftarKegiatanSchema,
  KegiatanService,
  toKegiatanDetail,
  toKegiatanListItem,
  toProspekDetail,
} from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "../akses-presurvei";

const service = new KegiatanService();

/** GET /api/presurvei/kegiatan — daftar kegiatan dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest, ctx) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarKegiatanSchema.parse({
      userId: searchParams.get("userId") ?? undefined,
      jenis: searchParams.get("jenis") ?? undefined,
      hasil: searchParams.get("hasil") ?? undefined,
      prospekId: searchParams.get("prospekId") ?? undefined,
      dariTanggal: searchParams.get("dariTanggal") ?? undefined,
      sampaiTanggal: searchParams.get("sampaiTanggal") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    // Sales tanpa permission web hanya melihat kegiatannya sendiri; filter
    // `userId` yang dikirim klien ditimpa, bukan dipercaya.
    const hasil = await service.daftar(
      isBolehLihatSemuaPresurvei(ctx.permissions)
        ? filters
        : { ...filters, userId: ctx.session!.user.id },
    );

    return apiPaginated(hasil.items.map(toKegiatanListItem), {
      page: filters.page,
      limit: filters.limit,
      total: hasil.total,
    });
  },
);

/** POST /api/presurvei/kegiatan — catat kegiatan sales atau marketing. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:create", "m_presurvei:create"],
    schema: catatKegiatanSchema,
  },
  async (_request, ctx) => {
    const hasil = await service.catat({
      ...ctx.validated,
      userId: ctx.session!.user.id,
    });

    return apiSuccess(
      {
        kegiatan: toKegiatanDetail(hasil.kegiatan),
        prospek: hasil.prospek ? toProspekDetail(hasil.prospek) : null,
      },
      { status: 201 },
    );
  },
);
