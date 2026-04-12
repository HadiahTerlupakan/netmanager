import { RadiusSyncService } from "@/modules/network";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

const radiusSyncService = new RadiusSyncService();

type RadiusResetErrorCode = "PELANGGAN_NOT_FOUND" | "ROUTER_NOT_FOUND";

function parseResetRequestBody(
  request: Request,
): Promise<{ username: string }> {
  return request
    .json()
    .then((body: unknown) => ({
      username:
        typeof body === "object" &&
        body !== null &&
        "username" in body &&
        typeof (body as { username?: unknown }).username === "string"
          ? (body as { username: string }).username.trim()
          : "",
    }))
    .catch(() => {
      throw new Error("INVALID_JSON");
    });
}

function mapResetError(result: {
  error?: string;
  errorCode?: RadiusResetErrorCode;
}) {
  if (
    result.errorCode === "PELANGGAN_NOT_FOUND" ||
    result.error === "Pelanggan tidak ditemukan untuk tenant ini"
  ) {
    return ApiErrors.notFound("Pelanggan");
  }

  if (
    result.errorCode === "ROUTER_NOT_FOUND" ||
    result.error === "Router pelanggan tidak ditemukan"
  ) {
    return ApiErrors.badRequest(
      result.error ?? "Router pelanggan tidak ditemukan",
    );
  }

  return ApiErrors.internalError(result.error || "Gagal reset koneksi");
}

export const POST = createHandler(
  { auth: true, permissions: ["radius:update"] },
  async (req, ctx) => {
    let body: { username: string };

    try {
      body = await parseResetRequestBody(req);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_JSON") {
        return ApiErrors.badRequest("Body JSON tidak valid");
      }

      return ApiErrors.internalError("Gagal membaca request");
    }

    const username = body.username;

    if (!username) {
      return ApiErrors.badRequest("Username wajib diisi");
    }

    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const result = await radiusSyncService.disconnectSessionByUsername(
      username,
      tenantId,
    );

    if (!result.success) {
      return mapResetError(result);
    }

    return apiSuccess(
      {
        username,
        disconnected: result.disconnected,
        ...(result.pelangganId ? { pelangganId: result.pelangganId } : {}),
      },
      {
        message: `Reset koneksi ${username} berhasil`,
      },
    );
  },
);
