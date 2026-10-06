import type { NextRequest } from "next/server";
import {
  ApiErrors,
  apiPaginated,
  apiSuccess,
  createHandler,
  requireSessionTenantId,
  requireSessionTenantIdUnlessSuperAdmin,
} from "@/lib/api";
import {
  buatProspekSchema,
  daftarProspekSchema,
  LingkupSalesService,
  ProspekService,
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "@/modules/roles";
import {
  ikatFilterProspekKeLingkup,
  ikatFilterProspekKePemanggil,
  isMenugaskanPemilik,
  tentukanPemilikProspek,
} from "../akses-presurvei";

const service = new ProspekService();
const lingkupSales = new LingkupSalesService();

/** GET /api/presurvei/prospek — daftar prospek dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest, ctx) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarProspekSchema.parse({
      status: searchParams.get("status") ?? undefined,
      sumber: searchParams.get("sumber") ?? undefined,
      jenis: searchParams.get("jenis") ?? undefined,
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

    // Lingkup menentukan prospek siapa yang terlihat: admin seluruh tenant,
    // kepala sales timnya, sales hanya miliknya. Filter `pemilikId` kiriman
    // klien ditimpa, dan `tanpaPemilik` ("false") dibuang sebagai lapis kedua.
    // `isBolehLihatSemua` (presurvei:read) dan lingkup sales
    // (presurvei_rencana:view_all) adalah izin berbeda. Begitu yang pertama
    // menolak, lingkup hanya boleh mempersempit — karenanya varian yang tak
    // pernah menjawab "tanpa batas".
    const idSalesTerlihat = isBolehLihatSemua
      ? undefined
      : await lingkupSales.idSalesTerlihatTanpaMelebarkan({
          penggunaId: ctx.session!.user.id,
          tenantId: requireSessionTenantId(ctx),
          permissions: ctx.permissions,
        });

    const hasil = await service.daftar(
      idSalesTerlihat === undefined
        ? filters
        : idSalesTerlihat.length === 1
          ? ikatFilterProspekKePemanggil(filters, idSalesTerlihat[0])
          : ikatFilterProspekKeLingkup(filters, idSalesTerlihat),
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

    // Penugasan pemilik divalidasi service sebagai sales se-tenant. Tenant
    // sesi hanya dibaca saat menugaskan, supaya pembuatan tanpa `pemilikId`
    // tetap berperilaku seperti sebelumnya.
    const penugasanPemilik = isMenugaskanPemilik(
      ctx.permissions,
      ctx.validated.pemilikId,
    )
      ? { tenantSesi: requireSessionTenantIdUnlessSuperAdmin(ctx) }
      : undefined;

    const prospek = await service.buat(
      {
        ...dataProspek,
        pemilikId: tentukanPemilikProspek(
          ctx.permissions,
          ctx.validated.pemilikId,
          ctx.session!.user.id,
        ),
      },
      { abaikanDuplikat, penugasanPemilik },
    );

    return apiSuccess(toProspekDetail(prospek), { status: 201 });
  },
);
