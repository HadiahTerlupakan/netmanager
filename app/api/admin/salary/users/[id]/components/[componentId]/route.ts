import { getSalaryUserService } from "@/modules/salary";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

const service = getSalaryUserService();

// DELETE - Remove component from user
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus komponen gaji",
    );
  }

  const { componentId } = ctx.params;
  const result = await service.removeComponent(componentId);

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(null, { message: "Komponen gaji berhasil dihapus" });
});
