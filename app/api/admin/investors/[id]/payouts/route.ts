import { apiSuccess, apiPaginated, ApiErrors, createHandler } from "@/lib/api";
import { investorPayoutSchema } from "@/lib/validations/investor";
import { ManualPaymentAdminRouteService } from "@/modules/finance";

const manualPaymentAdminRouteService = new ManualPaymentAdminRouteService();

export const GET = createHandler(
  {
    auth: true,
    permissions: ["investors:read"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const { payouts, total } =
      await manualPaymentAdminRouteService.getInvestorPayouts({
        investorId: id,
        page,
        limit,
      });
    return apiPaginated(payouts, { page, limit, total });
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["investors:create"],
    schema: investorPayoutSchema.omit({ investorId: true }),
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const {
      amount,
      date,
      bankName,
      accountNumber,
      accountName,
      reference,
      notes,
      status,
    } = ctx.validated;
    const payout = await manualPaymentAdminRouteService.createInvestorPayout({
      investorId: id,
      amount,
      date,
      bankName,
      accountNumber,
      accountName,
      reference,
      notes,
      status,
    });
    if (!payout) {
      return ApiErrors.notFound("Investor");
    }
    return apiSuccess(payout, { status: 201 });
  },
);
