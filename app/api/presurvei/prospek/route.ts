import type { NextRequest } from "next/server";
import { ApiErrors, apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  buatProspekSchema,
  daftarProspekSchema,
  ProspekService,
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei";
import {
  ikatFilterProspekKePemanggil,
  isBolehLihatSemuaPresurvei,
  tentukanPemilikProspek,
} from "../akses-presurvei";

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
      tanpaPemilik: searchParams.get("tanpaPemilik") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const isBolehLihatSemua = isBolehLihatSemuaPresurvei(ctx.permissions);

    // Prospek tak bertuan hanya untuk pemegang permission web. Ditolak keras,
    // bukan dibuang diam-diam: UI memeriksa izin dengan alias
    // (`contexts/PermissionContext.tsx:118-121`), route dengan string persis
    // (`akses-presurvei.ts`). Bila keduanya kelak berbeda pendapat, pembuangan
    // diam-diam menampilkan prospek milik sales sendiri di bawah judul
    // "Prospek tanpa pemilik"; 403 membuat perbedaan itu terlihat.
    if (filters.tanpaPemilik && !isBolehLihatSemua) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    // Sales tanpa permission web hanya melihat prospeknya sendiri; filter
    // `pemilikId` yang dikirim klien ditimpa, dan `tanpaPemilik` ("false")
    // dibuang sebagai lapis kedua.
    const hasil = await service.daftar(
      isBolehLihatSemua
        ? filters
        : ikatFilterProspekKePemanggil(filters, ctx.session!.user.id),
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
    const { abaikanDuplikat, ...dataProspek } = ctx.validated;

    const prospek = await service.buat(
      {
        ...dataProspek,
        pemilikId: tentukanPemilikProspek(
          ctx.permissions,
          ctx.validated.pemilikId,
          ctx.session!.user.id,
        ),
      },
      { abaikanDuplikat },
    );

    return apiSuccess(toProspekDetail(prospek), { status: 201 });
  },
);
