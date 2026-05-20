import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltDeviceService, updateOltDeviceSchema } from "@/modules/olt";

const oltDeviceService = new OltDeviceService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("olt:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat OLT");
    }

    const { id } = await params;
    const device = await oltDeviceService.getById(id);
    if (!device) {
      return ApiErrors.notFound("OLT tidak ditemukan");
    }

    return apiSuccess(device);
  } catch (error) {
    logger.error("Error fetching OLT device:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal mengambil data OLT";
    return ApiErrors.internalError(msg);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("olt_devices:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah OLT",
      );
    }

    const { id } = await params;
    const body = await req.json();
    const validated = updateOltDeviceSchema.parse(body);

    const device = await oltDeviceService.update(id, validated);
    return apiSuccess(device);
  } catch (error) {
    logger.error("Error updating OLT device:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return ApiErrors.badRequest("Data tidak valid", { details: error });
    }
    const msg = error instanceof Error ? error.message : "Gagal mengubah OLT";
    return ApiErrors.internalError(msg);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("olt_devices:delete"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus OLT",
      );
    }

    const { id } = await params;
    await oltDeviceService.delete(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting OLT device:", error);
    const msg = error instanceof Error ? error.message : "Gagal menghapus OLT";
    return ApiErrors.internalError(msg);
  }
}
