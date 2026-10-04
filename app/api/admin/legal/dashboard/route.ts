import { apiSuccess, createHandler } from "@/lib/api";
import { LegalDashboardService } from "@/modules/legal";
import { legalAccessFrom } from "../legal-route-helpers";

const dashboard = new LegalDashboardService();

/** GET /api/admin/legal/dashboard — tenggat yang perlu tindakan, paling mendesak dulu. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (_request, ctx) => apiSuccess(await dashboard.summary(legalAccessFrom(ctx))),
);
