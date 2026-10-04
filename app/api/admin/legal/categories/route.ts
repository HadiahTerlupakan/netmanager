import { apiSuccess, createHandler } from "@/lib/api";
import {
  createLegalCategorySchema,
  LegalCategoryService,
  toLegalCategoryDto,
} from "@/modules/legal";
import { legalAccessFrom } from "../legal-route-helpers";

const categories = new LegalCategoryService();

/** GET /api/admin/legal/categories — kategori tenant (bawaan dibuat saat pertama dibuka). */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (_request, ctx) => {
    const items = await categories.list(legalAccessFrom(ctx));

    return apiSuccess({ items: items.map(toLegalCategoryDto) });
  },
);

/** POST /api/admin/legal/categories — tambah kategori milik tenant. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: createLegalCategorySchema,
  },
  async (_request, ctx) => apiSuccess(toLegalCategoryDto(await categories.create(ctx.validated))),
);
