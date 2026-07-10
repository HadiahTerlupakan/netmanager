import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";
import type { InvestorProfitShareStatus } from "@prisma/client";

const VALID_STATUSES: InvestorProfitShareStatus[] = [
  "CALCULATED",
  "APPROVED",
  "PAID",
];

function parseStatusParam(
  value: string | null,
): InvestorProfitShareStatus | undefined {
  if (!value || value === "ALL") return undefined;
  return VALID_STATUSES.includes(value as InvestorProfitShareStatus)
    ? (value as InvestorProfitShareStatus)
    : undefined;
}

/** GET: Mengambil semua profit share tenant (opsional filter ?status=). */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    const { searchParams } = new URL(req.url);
    const status = parseStatusParam(searchParams.get("status"));

    const service = getInvestorProfitShareService();
    const shares = await service.listAllByTenant(
      tenantId,
      status ? { status } : undefined,
    );
    return apiSuccess(shares);
  },
);
