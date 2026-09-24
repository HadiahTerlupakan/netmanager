import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  RingkasanSalesService,
  toRingkasanSalesDto,
} from "@/modules/presurvei";

const service = new RingkasanSalesService();

/**
 * GET /api/mobile/presurvei/ringkasan — ringkasan Beranda sales milik pemanggil.
 *
 * Tanpa parameter: pemilik selalu id sesi dan tenant selalu tenant sesi,
 * sehingga tidak ada masukan klien yang bisa menunjuk data orang lain.
 * Sesi tanpa tenant — termasuk super admin — ditolak 400 oleh
 * `requireSessionTenantId` (`lib/api/session-tenant.ts`).
 */
export const GET = createHandler(
  { auth: true, permissions: ["m_presurvei:read"] },
  async (_request, ctx) => {
    const ringkasan = await service.ringkasan({
      userId: ctx.session!.user.id,
      tenantId: requireSessionTenantId(ctx),
      sekarang: new Date(),
    });
    return apiSuccess(toRingkasanSalesDto(ringkasan));
  },
);
