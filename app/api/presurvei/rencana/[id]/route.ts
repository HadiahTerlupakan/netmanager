import { apiSuccess, createHandler } from "@/lib/api";
import {
  RencanaService,
  toRencanaDto,
  toRincianRencanaDto,
  ubahRencanaSchema,
} from "@/modules/presurvei";
import { muatKonteksRencana } from "../konteks-rencana";

const service = new RencanaService();

/** GET /api/presurvei/rencana/[id] — rincian rencana beserta laporannya. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_rencana:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
    const rincian = await service.rincian(
      ctx.params.id as string,
      lingkup,
      pengguna.tenantId,
    );
    const waktu = await service.konteksWaktu(pengguna.tenantId);
    return apiSuccess(toRincianRencanaDto(rincian, waktu));
  },
);

/**
 * PATCH /api/presurvei/rencana/[id] — jadwal ulang atau ubah tujuan selagi
 * DIRENCANAKAN. Sales hanya rencana MANDIRI miliknya; penugasan diatur
 * pemberinya (kepala sales/admin dalam lingkup).
 */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei_rencana:update", "m_presurvei:update"],
    schema: ubahRencanaSchema,
  },
  async (_request, ctx) => {
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
    const rencana = await service.ubah(
      ctx.params.id as string,
      ctx.validated,
      lingkup,
      pengguna.tenantId,
    );
    const waktu = await service.konteksWaktu(pengguna.tenantId);
    return apiSuccess(toRencanaDto(rencana, waktu));
  },
);
