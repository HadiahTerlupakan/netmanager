import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorDepositService } from "@/modules/investor";
import type { InvestorDepositStatus } from "@prisma/client";

const VALID_STATUSES: InvestorDepositStatus[] = [
  "PENDING",
  "VERIFIED",
  "COMPLETED",
  "REJECTED",
];

function parseStatusParam(
  value: string | null,
): InvestorDepositStatus | undefined {
  if (!value || value === "ALL") return undefined;
  return VALID_STATUSES.includes(value as InvestorDepositStatus)
    ? (value as InvestorDepositStatus)
    : undefined;
}

/** GET: Mengambil daftar deposit untuk admin (default semua, filter by ?status=). */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    const { searchParams } = new URL(req.url);
    const status = parseStatusParam(searchParams.get("status"));

    const service = getInvestorDepositService();
    const deposits = await service.listAllByTenant(
      tenantId,
      status ? { status } : undefined,
    );
    return apiSuccess(deposits);
  },
);
