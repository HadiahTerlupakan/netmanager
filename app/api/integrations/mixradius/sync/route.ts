import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  getMixRadiusSyncService,
} from "@/modules/integrations";
import type { MixRadiusCustomerDetail } from "@/modules/integrations";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Anda tidak memiliki akses ke MixRadius");
  }

  const body = await req.json();
  const customerData = body as MixRadiusCustomerDetail;

  if (!customerData || !customerData.id || !customerData.username) {
    return apiError(
      "Data pelanggan tidak valid. Pastikan ID dan Username tersedia.",
      ErrorCodes.VALIDATION_ERROR,
      {
        details: {
          missingFields: [
            !customerData?.id ? "ID Pelanggan" : "",
            !customerData?.username ? "Username" : "",
          ].filter(Boolean),
        },
        status: 400,
      },
    );
  }

  const result = await getMixRadiusSyncService().syncCustomer(
    customerData,
    user.tenantId,
  );

  return apiSuccess({
    action: result.action,
    localId: result.customer.id,
    customer: result.customer,
    message:
      result.action === "created"
        ? "Berhasil membuat data pelanggan"
        : "Berhasil memperbarui data pelanggan",
  });
});
