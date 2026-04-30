import { isSuperAdmin } from "@/lib/auth";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getMixRadiusAccessService,
  MixRadiusFeeSettingsService,
} from "@/modules/integrations";

export const dynamic = "force-dynamic";

const mixRadiusFeeSettingsService = new MixRadiusFeeSettingsService();

export const GET = createHandler({ auth: true }, async (req, ctx) => {
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
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) return ApiErrors.forbidden();

  const body = await req.json();
  const config = await mixRadiusFeeSettingsService.saveConfig(body);
  return apiSuccess(config, { message: "Konfigurasi fee berhasil disimpan" });
});
