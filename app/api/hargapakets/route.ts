import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { HargaPaketService } from "@/modules/network";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
  buildSessionWithPermissions,
} from "@/lib/api";
import { checkSiteRestriction } from "@/modules/roles";
import type { Session } from "next-auth";

const hargaPaketService = new HargaPaketService();

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("harga:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat harga paket",
    );
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") || undefined;
  const featured = searchParams.get("featured");
  const siteIdParam = searchParams.get("siteId");

  const options: Record<string, unknown> = {};
  if (status) options.status = status;
  if (featured !== null) options.featured = featured === "true";

  const { isRestricted, siteIds } = checkSiteRestriction(
    buildSessionWithPermissions(ctx.session!, ctx.permissions),
    "harga",
  );

  if (isRestricted && siteIds.length > 0) {
    options.siteId = { in: siteIds };
  } else if (siteIdParam) {
    options.siteId = siteIdParam;
  }

  const hargaPakets = await hargaPaketService.getAllHargaPakets(options);
  return apiSuccess(hargaPakets);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("harga:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat harga paket",
    );
  }

  const body = await req.json();
  const user = ctx.session!.user;

  if (user.tenantId) {
    body.tenantId = user.tenantId;
  }

  const { isRestricted, primarySiteId } = checkSiteRestriction(
    buildSessionWithPermissions(ctx.session!, ctx.permissions),
    "harga",
  );

  if (isRestricted) {
    if (!primarySiteId) {
      return ApiErrors.forbidden("User tidak memiliki akses site");
    }
    body.siteId = primarySiteId;
  }

  try {
    const hargaPaket = await hargaPaketService.createHargaPaket(body, user.id);
    return apiSuccess(hargaPaket, {
      status: 201,
      message: "Harga paket berhasil dibuat",
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: string; details?: unknown };
    logger.error("[HargaPaket POST Error]:", err);

    if (err.code === "VALIDATION_ERROR") {
      return apiError(err.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: err.details as Record<string, unknown>,
      });
    }

    if (err.code === "P2002") {
      return apiError("Nama paket sudah digunakan", ErrorCodes.CONFLICT, {
        status: 409,
      });
    }

    if (err.code === "P2003") {
      return apiError(
        "Bandwidth atau Profile PPP tidak ditemukan",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    return ApiErrors.internalError(err?.message || "Gagal membuat harga paket");
  }
});
