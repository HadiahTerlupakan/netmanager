import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { setGatewayConfigRevoked } from "@/modules/payment-gateway";

const revocationSchema = z.object({ isRevoked: z.boolean() });

// PUT /api/admin/payment-gateway/configs/[provider]/revocation
// `{ isRevoked: true }` mencabut konfigurasi gateway tenant ini (sakelar
// darurat: checkout baru, callback, dan cek status ditolak);
// `{ isRevoked: false }` memulihkannya.
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("payment_gateway:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah payment gateway",
    );
  }

  const { tenantId } = await getTenantIdFromContext();
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const body = revocationSchema.safeParse(
    await req.json().catch((): unknown => null),
  );
  if (!body.success) {
    return ApiErrors.badRequest("isRevoked (boolean) wajib diisi");
  }

  const config = await setGatewayConfigRevoked({
    provider: ctx.params.provider,
    tenantId,
    isRevoked: body.data.isRevoked,
  });
  if (!config) {
    return ApiErrors.notFound("Konfigurasi payment gateway");
  }

  logActivitySafe({
    action: config.isRevoked ? "REVOKE" : "RESTORE",
    subject: "Payment Gateway Config",
    userId: ctx.session!.user.id,
    tenantId,
    details: {
      id: config.id,
      provider: config.provider,
      isRevoked: config.isRevoked,
    },
  });

  return apiSuccess(config, {
    message: config.isRevoked
      ? "Konfigurasi payment gateway dicabut"
      : "Konfigurasi payment gateway dipulihkan",
  });
});
