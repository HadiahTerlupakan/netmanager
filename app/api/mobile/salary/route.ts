import { apiSuccess, createHandler } from "@/lib/api";
import { getMobileSalaryList } from "@/modules/salary";

/** Mengambil daftar slip gaji mobile untuk user yang sedang login. */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["m_salary:read"],
  },
  async (_req, ctx) => {
    const userSession = ctx.session!.user;
    return apiSuccess(
      await getMobileSalaryList({
        id: userSession.id,
        tenantId: userSession.tenantId as string,
      }),
    );
  },
);
