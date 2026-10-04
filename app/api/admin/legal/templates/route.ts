import { apiSuccess, createHandler } from "@/lib/api";
import {
  createLegalTemplateSchema,
  LegalTemplateService,
  TEMPLATE_PLACEHOLDERS,
  toLegalTemplateDto,
} from "@/modules/legal";
import { legalAccessFrom } from "../legal-route-helpers";

const templates = new LegalTemplateService();

/** GET /api/admin/legal/templates — template tenant (bawaan dibuat saat pertama dibuka) dan daftar isian. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async () => {
    const items = await templates.list();

    return apiSuccess({
      items: items.map(toLegalTemplateDto),
      placeholders: TEMPLATE_PLACEHOLDERS,
    });
  },
);

/** POST /api/admin/legal/templates — tambah template milik tenant. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: createLegalTemplateSchema,
  },
  async (_request, ctx) =>
    apiSuccess(toLegalTemplateDto(await templates.create(ctx.validated, legalAccessFrom(ctx)))),
);
