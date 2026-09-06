import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  BandwidthProfileService,
  updateBandwidthProfileSchema,
} from "@/modules/olt";

const bwService = new BandwidthProfileService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt:read")))
      return ApiErrors.forbidden("Anda tidak memiliki akses");

    const { id } = await params;
    const profile = await bwService.getById(id, session.user.tenantId);
    if (!profile) return ApiErrors.notFound("Profile");

    return apiSuccess(profile);
  } catch (error) {
    logger.error("Error fetching bandwidth profile:", error);
    return ApiErrors.internalError("Gagal mengambil data");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_devices:update")))
      return ApiErrors.forbidden("Anda tidak memiliki akses");

    const { id } = await params;
    const body = await req.json();
    const validated = updateBandwidthProfileSchema.parse(body);

    const profile = await bwService.update(
      id,
      session.user.tenantId,
      validated,
    );
    return apiSuccess(profile);
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error updating bandwidth profile:", error);
    return ApiErrors.internalError("Gagal mengubah profile");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_devices:delete")))
      return ApiErrors.forbidden("Anda tidak memiliki akses");

    const { id } = await params;
    await bwService.delete(id, session.user.tenantId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting bandwidth profile:", error);
    return ApiErrors.internalError("Gagal menghapus profile");
  }
}
