import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { getMobileSalaryDetail } from "@/modules/salary";

export const GET = createHandler(
  { auth: true, permissions: ["m_salary:read"] },
  async (_req, ctx) => {
    const salary = await getMobileSalaryDetail(
      {
        id: ctx.session!.user.id,
        tenantId: ctx.session!.user.tenantId!,
      },
      ctx.params.id,
    );

    if (!salary) {
      return apiError(
        "Gaji tidak ditemukan atau tidak tersedia",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    return apiSuccess(salary);
  },
);
