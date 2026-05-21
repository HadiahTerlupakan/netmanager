import { apiSuccess, createHandler } from "@/lib/api";
import { getPayrollEntryRepository } from "@/modules/salary";

/** Mengambil daftar slip gaji mobile untuk user yang sedang login. */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["m_salary:read"],
  },
  async (_req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId as string;

    const repo = getPayrollEntryRepository();
    const entries = await repo.findByUserId(userId, tenantId);

    return apiSuccess(entries);
  },
);
