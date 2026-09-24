import type { NextRequest } from "next/server";
import {
  apiPaginated,
  createHandler,
  executeMobileWithIdempotency,
} from "@/lib/api";
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

const HTTP_CREATED = 201;

/** Cakupan kunci idempotensi catat kegiatan, dipisah per tenant sesi. */
const CAKUPAN_IDEMPOTENSI_CATAT = "presurvei:kegiatan:create";

/** Pengisi cakupan untuk sesi tanpa tenant (super admin lintas tenant). */
const TENANT_KOSONG = "tanpa-tenant";

/**
 * Bangun cakupan kunci idempotensi. `GenericIdempotencyService` sudah
 * menyisipkan userId ke kunci (`lib/api/idempotency.ts` buildKey); tenant
 * ditambahkan di sini karena tenant sesi super admin bisa berganti, dan
 * respons milik tenant A tidak boleh diputar ulang di tenant B.
 */
function bangunCakupanIdempotensi(tenantId: string | undefined): string {
  return `${CAKUPAN_IDEMPOTENSI_CATAT}:${tenantId ?? TENANT_KOSONG}`;
}

/** GET /api/presurvei/kegiatan — daftar kegiatan dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest, ctx) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarKegiatanSchema.parse({
      userId: searchParams.get("userId") ?? undefined,
      peran: searchParams.get("peran") ?? undefined,
      departemenId: searchParams.get("departemenId") ?? undefined,
      jenis: searchParams.get("jenis") ?? undefined,
      hasil: searchParams.get("hasil") ?? undefined,
      prospekId: searchParams.get("prospekId") ?? undefined,
      dariTanggal: searchParams.get("dariTanggal") ?? undefined,
      sampaiTanggal: searchParams.get("sampaiTanggal") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    // Sales tanpa permission web hanya melihat kegiatannya sendiri; filter
    // `userId` yang dikirim klien ditimpa, bukan dipercaya. `peran` dan
    // `departemenId` tetap diteruskan: keduanya hanya mempersempit.
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

/**
 * POST /api/presurvei/kegiatan — catat kegiatan sales atau marketing.
 *
 * Idempoten bila klien mengirim header `Idempotency-Key`: mobile mengirim
 * ulang kegiatan dari antrean offline setelah POST pertama timeout, padahal
 * server bisa saja sudah commit — tanpa ini kegiatan (dan prospek baru)
 * tercatat ganda. Tanpa header, perilakunya tetap seperti semula.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:create", "m_presurvei:create"],
    schema: catatKegiatanSchema,
  },
  async (request, ctx) =>
    executeMobileWithIdempotency({
      request,
      scope: bangunCakupanIdempotensi(ctx.session!.user.tenantId),
      userId: ctx.session!.user.id,
      body: ctx.validated,
      status: HTTP_CREATED,
      handler: async () => {
        const hasil = await service.catat({
          ...ctx.validated,
          userId: ctx.session!.user.id,
        });
        return {
          kegiatan: toKegiatanDetail(hasil.kegiatan),
          prospek: hasil.prospek ? toProspekDetail(hasil.prospek) : null,
        };
      },
    }),
);
