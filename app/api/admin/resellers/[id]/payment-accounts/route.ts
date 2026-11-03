import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  getResellerSettlementLifecycleService,
  RESELLER_FINANCE_PERMISSIONS,
} from "@/modules/reseller";

/**
 * Rekening Kas & Bank aktif untuk form bayar settlement. Izinnya sama dengan
 * route bayar, jadi pembayar tidak butuh izin baca kas tersendiri.
 */
export const GET = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
    feature: "reseller",
  },
  async (_req, ctx) => {
    const accounts =
      await getResellerSettlementLifecycleService().listPaymentAccounts(
        requireSessionTenantId(ctx),
      );
    return apiSuccess(accounts);
  },
);
