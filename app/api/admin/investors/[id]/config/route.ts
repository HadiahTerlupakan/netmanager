import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorConfigService } from "@/modules/investor";

const updateConfigSchema = z.object({
  shareMode: z.enum(["FIXED", "PROPORTIONAL"]),
  fixedSharePercent: z.number().min(0).max(100).optional().nullable(),
  periodType: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  isActive: z.boolean(),
});

/** GET: Mengambil config investor. */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const service = getInvestorConfigService();
    const config = await service.getConfig(id);
    return apiSuccess(config);
  },
);

/** PUT: Update config investor. */
export const PUT = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const { id } = ctx.params;
    const body = await req.json();
    const data = updateConfigSchema.parse(body);
    const tenantId = ctx.session?.user.tenantId;

    try {
      const service = getInvestorConfigService();
      const config = await service.upsertConfig(id, {
        shareMode: data.shareMode,
        fixedSharePercent: data.fixedSharePercent,
        periodType: data.periodType,
        isActive: data.isActive,
        tenantId: tenantId ?? undefined,
      });
      return apiSuccess(config);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
