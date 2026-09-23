import { apiSuccess, createHandler } from "@/lib/api";
import {
  KegiatanService,
  toKegiatanRincian,
  ubahKegiatanSchema,
} from "@/modules/presurvei";
import { pemilikWajibUntuk } from "../../akses-presurvei";

const service = new KegiatanService();

/** GET /api/presurvei/kegiatan/[id] — rincian satu kegiatan beserta riwayatnya. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const rincian = await service.rincian(
      ctx.params.id as string,
      pemilikWajibUntuk(ctx),
    );
    return apiSuccess(toKegiatanRincian(rincian));
  },
);

/**
 * PATCH /api/presurvei/kegiatan/[id] — ubah catatan, nama yang ditemui, atau
 * hasil. Medan lain ditolak 400 oleh `ubahKegiatanSchema` (`.strict()`).
 *
 * Pemanggil mobile hanya boleh mengubah kegiatannya sendiri (`pemilikWajib`),
 * pemegang permission web kegiatan mana pun di tenantnya. Pengubah yang
 * tercatat di jejak audit selalu identitas sesi; tenant riwayat diturunkan
 * service dari baris kegiatan, bukan dari masukan klien.
 */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei:update", "m_presurvei:update"],
    schema: ubahKegiatanSchema,
  },
  async (_request, ctx) => {
    const rincian = await service.ubah(ctx.params.id as string, ctx.validated, {
      idPengubah: ctx.session!.user.id,
      pemilikWajib: pemilikWajibUntuk(ctx),
    });
    return apiSuccess(toKegiatanRincian(rincian));
  },
);
