import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  isVpnError,
  MikroTikRouterService,
  vpnErrorResponse,
} from "@/modules/network";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = await req.json();
  const { routerId } = body;

  if (!body.ipAddress && !routerId) {
    return apiError("IP Address is required", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const routerService = new MikroTikRouterService();
  let result: Awaited<ReturnType<MikroTikRouterService["testConnection"]>>;
  try {
    result = await routerService.testConnection({
      tenantId: ctx.session!.user.tenantId,
      routerId,
      vpnDraftId:
        typeof body.vpnDraftId === "string" ? body.vpnDraftId : undefined,
      ipAddress: body.ipAddress,
      apiPort: body.apiPort ?? 8728,
      apiUsername: body.apiUsername,
      apiPassword: body.apiPassword,
    });
  } catch (error: unknown) {
    if (isVpnError(error)) return vpnErrorResponse(error);
    throw error;
  }

  return apiSuccess({
    success: result.apiResult.success,
    api: result.apiResult,
    routerInfo: result.routerInfo,
    message: result.apiResult.success
      ? "Koneksi berhasil! API dapat diakses dengan autentikasi yang benar."
      : "Koneksi gagal. Periksa IP Address, port, username, password, and pastikan router dapat dijangkau dari server ini.",
  });
});
