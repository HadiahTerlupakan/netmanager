import { apiSuccess, createHandler } from "@/lib/api";
import {
  LegalTemplateService,
  toLegalTemplateDto,
  updateLegalTemplateSchema,
} from "@/modules/legal";
import { legalAccessFrom } from "../../legal-route-helpers";

const templates = new LegalTemplateService();

/** GET /api/admin/legal/templates/[id] — satu template beserta isinya. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (_request, ctx) =>
    apiSuccess(toLegalTemplateDto(await templates.getById(ctx.params.id as string))),
);

/** PATCH /api/admin/legal/templates/[id] — ubah nama, kategori, isi, atau status aktif. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: updateLegalTemplateSchema,
  },
  async (_request, ctx) => {
    const template = await templates.update(
      ctx.params.id as string,
      ctx.validated,
      legalAccessFrom(ctx),
    );

    return apiSuccess(toLegalTemplateDto(template));
  },
);
