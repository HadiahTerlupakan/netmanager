import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { getPayrollEntryRepository } from "@/modules/salary";

/** Mengambil detail slip gaji beserta line items. */
export const GET = createHandler(
  { auth: true, permissions: ["m_salary:read"] },
  async (_req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId as string;
    const entryId = ctx.params.id;

    const repo = getPayrollEntryRepository();
    const entry = await repo.findById(entryId, tenantId);

    if (!entry || entry.userId !== userId) {
      return apiError(
        "Gaji tidak ditemukan atau tidak tersedia",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    return apiSuccess(entry);
  },
);
