import { apiSuccess, createHandler } from "@/lib/api";
import {
  LegalCategoryService,
  toLegalCategoryDto,
  updateLegalCategorySchema,
} from "@/modules/legal";
import { legalAccessFrom } from "../../legal-route-helpers";

const categories = new LegalCategoryService();

/** PATCH /api/admin/legal/categories/[id] — ubah nama, kerahasiaan, atau status aktif. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: updateLegalCategorySchema,
  },
  async (_request, ctx) => {
    const category = await categories.update(
      ctx.params.id as string,
      ctx.validated,
      legalAccessFrom(ctx),
    );

    return apiSuccess(toLegalCategoryDto(category));
  },
);
