import { NextResponse } from "next/server";
import { createHandler, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("isolir_page:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat halaman isolir",
    );
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Pilih tenant");

  const { getIsolirPageService } = await import("@/modules/network");
  const { html } = await getIsolirPageService().renderForTenant(tenantId);
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});
