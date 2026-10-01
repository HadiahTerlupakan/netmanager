import {
  apiPaginated,
  createHandler,
  executeMobileWithIdempotency,
} from "@/lib/api";
import {
  buatRencanaSchema,
  daftarRencanaSchema,
  RencanaService,
  toRencanaDto,
} from "@/modules/presurvei";
import { muatKonteksRencana } from "./konteks-rencana";

const service = new RencanaService();

/**
 * GET /api/presurvei/rencana — agenda rencana kunjungan dalam lingkup pemanggil.
 *
 * Sales (mobile) hanya miliknya; kepala sales dirinya + tim; admin
 * (`presurvei_rencana:view_all`) seluruh tenant. `status=TERLEWAT` memilih
 * rencana yang belum dilaporkan dan tanggalnya sudah lewat.
 */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_rencana:read", "m_presurvei:read"] },
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarRencanaSchema.parse({
      dari: searchParams.get("dari") ?? undefined,
      sampai: searchParams.get("sampai") ?? undefined,
      salesId: searchParams.get("salesId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
    const hasil = await service.daftar(filters, lingkup, pengguna.tenantId);

    return apiPaginated(
      hasil.items.map((rencana) => toRencanaDto(rencana, hasil.waktu)),
      { page: filters.page, limit: filters.limit, total: hasil.total },
    );
  },
);

/**
 * POST /api/presurvei/rencana — buat rencana untuk diri sendiri (MANDIRI) atau
 * tugaskan ke sales dalam lingkup (PENUGASAN, sales dikabari lewat notifikasi).
 *
 * Idempoten per `Idempotency-Key`/`requestId`: ketukan ganda dari HP tidak
 * melahirkan dua rencana.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei_rencana:create", "m_presurvei:create"],
    schema: buatRencanaSchema,
  },
  async (request, ctx) =>
    executeMobileWithIdempotency({
      request,
      scope: `presurvei:rencana:create:${ctx.session!.user.tenantId ?? "tanpa-tenant"}`,
      userId: ctx.session!.user.id,
      body: ctx.validated,
      status: 201,
      handler: async () => {
        const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
        const rencana = await service.buat(ctx.validated, pengguna, lingkup);
        const waktu = await service.konteksWaktu(pengguna.tenantId);
        return toRencanaDto(rencana, waktu);
      },
    }),
);
