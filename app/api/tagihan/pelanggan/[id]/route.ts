import { apiSuccess, createHandler, ApiErrors } from "@/lib/api";
import {
  CustomerLegacyBillingError,
  CustomerLegacyBillingService,
} from "@/modules/pelanggan";

const service = new CustomerLegacyBillingService();

export const GET = createHandler(
  { auth: true, permissions: ["pelanggan:read"] },
  async (req, ctx) => {
    const { id: pelangganId } = ctx.params;
    const session = ctx.session!;
    const tenantId = session.user.tenantId ?? null;
    const isSuperAdmin = Boolean(
      session.user.isSuperAdmin || session.user.role === "SUPER_ADMIN",
    );

    try {
      const result = await service.getCustomerTagihan({
        pelangganId,
        tenantId,
        isSuperAdmin,
        session: session as Parameters<
          CustomerLegacyBillingService["getCustomerTagihan"]
        >[0]["session"],
        isLatest: new URL(req.url).searchParams.get("latest") === "true",
      });

      return apiSuccess(result);
    } catch (error) {
      if (error instanceof CustomerLegacyBillingError) {
        if (error.status === 404) return ApiErrors.notFound("Pelanggan");
        return ApiErrors.forbidden(error.message);
      }

      throw error;
    }
  },
);
