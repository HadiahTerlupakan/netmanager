import { apiSuccess, createHandler } from "@/lib/api";
import { getChartOfAccountService } from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["coa:manage"] },
  async (request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    const service = getChartOfAccountService();
    const existing = await service.list(tenantId, {});
    const hasSystem = existing.some((a) => a.isSystem);

    if (hasSystem && !force) {
      return apiSuccess({
        status: "exists",
        message: "Akun standar sudah tersedia",
      });
    }

    if (hasSystem && force) {
      await service.resetSystemAccounts(tenantId);
    }

    const items = await service.list(tenantId, {});
    return apiSuccess({
      status: "seeded",
      seeded: items.length,
      message: "Akun standar berhasil dibuat",
    });
  },
);
