import { isSuperAdmin } from "@/lib/auth";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getMixRadiusAccessService,
  MixRadiusFeeSettingsService,
} from "@/modules/integrations";
import * as z from "zod";

export const dynamic = "force-dynamic";

const mixRadiusFeeSettingsService = new MixRadiusFeeSettingsService();

const feeConfigSchema = z.record(
  z.string(),
  z.object({
    type: z.enum(["FIXED", "PERCENT"]),
    value: z.number().min(0),
  }),
);

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) return ApiErrors.forbidden();

  const config = await mixRadiusFeeSettingsService.getConfig();
  return apiSuccess(config);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:write"],
  });

  if (!hasAccess) return ApiErrors.forbidden();

  const body = await req.json();
  const parsed = feeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest("Format konfigurasi fee tidak valid");
  }

  const config = await mixRadiusFeeSettingsService.saveConfig(parsed.data);
  return apiSuccess(config, { message: "Konfigurasi fee berhasil disimpan" });
});
