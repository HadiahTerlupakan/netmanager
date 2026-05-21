import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";

const calculateSchema = z.object({
  periodStart: z.string().transform((s) => new Date(s)),
  periodEnd: z.string().transform((s) => new Date(s)),
  netProfit: z.number().positive("Net profit harus positif"),
});

/** POST: Trigger kalkulasi bagi hasil untuk semua investor aktif. */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const body = await req.json();
    const data = calculateSchema.parse(body);
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    const service = getInvestorProfitShareService();
    const shares = await service.calculateForPeriod(
      tenantId,
      data.periodStart,
      data.periodEnd,
      data.netProfit,
    );

    return apiSuccess(shares, { status: 201 });
  },
);
