import {
  formatSalarySlipReceipt,
  getSalaryService,
  mapSalaryReceiptData,
} from "@/modules/salary";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat slip gaji",
    );
  }

  const { id } = ctx.params;
  const service = getSalaryService();
  const result = await service.getSalaryById(id);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Data gaji");
    }
    return ApiErrors.internalError(result.error);
  }

  const receiptData = mapSalaryReceiptData(result.data);
  const slip = formatSalarySlipReceipt(receiptData);

  return apiSuccess({ slip, salary: result.data });
});
