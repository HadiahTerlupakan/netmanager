import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  companyBankAccountSchema,
  type CompanyBankAccountInput,
} from "@/lib/validations/settings";
async function getService() {
  const { getCompanyBankAccountService } = await import("@/modules/finance");
  return getCompanyBankAccountService();
}

export const PUT = createHandler(
  {
    auth: true,
    schema: companyBankAccountSchema,
  },
  async (_req, ctx) => {
    const { session, params } = ctx;
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("bank_accounts:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah rekening bank perusahaan",
      );
    }

    const id = params?.id;
    if (!id) {
      return ApiErrors.badRequest("ID account is required");
    }

    const service = await getService();
    const result = await service.updateAccount(
      id,
      ctx.validated as CompanyBankAccountInput,
    );
    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound(result.error);
      }

      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(result.data);
  },
);

export const DELETE = createHandler(
  {
    auth: true,
  },
  async (req, ctx) => {
    const { session, params } = ctx;
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("bank_accounts:delete"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus rekening bank perusahaan",
      );
    }

    const id = params?.id;
    if (!id) {
      return ApiErrors.badRequest("ID account is required");
    }

    const service = await getService();
    const result = await service.deleteAccount(id);
    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound(result.error);
      }

      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(null);
  },
);
