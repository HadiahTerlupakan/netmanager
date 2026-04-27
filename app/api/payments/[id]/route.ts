import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getPaymentForRoute } from "@/modules/finance";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const result = await getPaymentForRoute({
    paymentId: ctx.params.id,
    user: ctx.session?.user,
  });

  if (result.status === "not-found") {
    return ApiErrors.notFound("Pembayaran");
  }

  if (result.status === "forbidden-site") {
    return ApiErrors.forbidden(
      "Akses ditolak. Pembayaran ini bukan milik site Anda.",
    );
  }

  if (result.status === "forbidden-tenant") {
    return ApiErrors.forbidden(
      "Akses ditolak. Pembayaran ini bukan milik tenant Anda.",
    );
  }

  return apiSuccess(result.data);
});
