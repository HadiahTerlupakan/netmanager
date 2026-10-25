import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

async function loadModule() {
  return import("@/modules/network");
}

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("isolir_page:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah halaman isolir",
    );
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Pilih tenant");

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) {
    return ApiErrors.badRequest("File tidak ditemukan");
  }

  const { getIsolirPageService, IsolirLogoError } = await loadModule();
  try {
    const page = await getIsolirPageService().setLogo(tenantId, file);
    return apiSuccess({ logoUrl: page.logoUrl });
  } catch (error) {
    if (error instanceof IsolirLogoError) {
      return ApiErrors.badRequest(error.message);
    }
    throw error;
  }
});

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("isolir_page:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah halaman isolir",
    );
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Pilih tenant");

  const { getIsolirPageService } = await loadModule();
  await getIsolirPageService().removeLogo(tenantId);
  return apiSuccess({ success: true });
});
