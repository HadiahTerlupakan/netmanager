import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  isolirPageSchema,
  type IsolirPageBody,
} from "@/lib/validations/isolir-page";

async function getService() {
  const { getIsolirPageService } = await import("@/modules/network");
  return getIsolirPageService();
}

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("isolir_page:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat halaman isolir",
    );
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Pilih tenant");

  return apiSuccess(await (await getService()).get(tenantId));
});

export const PUT = createHandler(
  { auth: true, schema: isolirPageSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("isolir_page:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah halaman isolir",
      );
    }
    const tenantId = ctx.session?.user?.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Pilih tenant");

    const service = await getService();
    return apiSuccess(
      await service.update(tenantId, ctx.validated as IsolirPageBody),
    );
  },
);
