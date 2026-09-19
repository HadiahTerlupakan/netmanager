import * as z from "zod";

import {
  apiSuccess,
  ApiErrors,
  createHandler,
  buildSessionWithPermissions,
} from "@/lib/api";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";
import { createMitraSchema } from "@/lib/validations/mitra";

const listQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(["MITRA_TEKNISI", "MITRA_SALES"]).optional(),
  active: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = createHandler(
  {
    auth: true,
    permissions: ["mitra:read"],
  },
  async (request, ctx) => {
    const parsed = listQuerySchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest("Query parameter tidak valid");
    }
    const { search, type, active, page, limit } = parsed.data;

    const { isRestricted, siteIds } = checkSiteRestriction(
      buildSessionWithPermissions(ctx.session!, ctx.permissions),
      "mitra",
    );

    const result = await getMitraService().getMitras(
      {
        search,
        employeeType: type,
        isActive: active ? active === "true" : undefined,
        allowedSiteIds: isRestricted ? siteIds : undefined,
      },
      page,
      limit,
    );

    if (!result.success) {
      return ApiErrors.internalError(result.error || "Gagal mengambil mitra");
    }

    return apiSuccess(result.data);
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["mitra:create"],
    schema: createMitraSchema,
  },
  async (_request, ctx) => {
    const user = ctx.session!.user;
    const body = ctx.validated;

    const { isRestricted, siteIds } = checkSiteRestriction(
      buildSessionWithPermissions(ctx.session!, ctx.permissions),
      "mitra",
    );
    if (isRestricted && body.siteId && !siteIds.includes(body.siteId)) {
      return ApiErrors.forbidden(
        "Anda tidak dapat membuat mitra untuk site di luar scope Anda",
      );
    }

    const result = await getMitraService().createMitra(body, user.id);

    if (!result.success) {
      return ApiErrors.badRequest(result.error || "Gagal membuat mitra");
    }

    return apiSuccess(result.data, { status: 201 });
  },
);
