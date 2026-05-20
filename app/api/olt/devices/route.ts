import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  OltDeviceService,
  createOltDeviceSchema,
  oltDeviceListQuerySchema,
} from "@/modules/olt";

const oltDeviceService = new OltDeviceService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("olt:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat OLT");
    }

    const { searchParams } = new URL(req.url);
    const query = oltDeviceListQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      vendor: searchParams.get("vendor") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    const result = await oltDeviceService.list({
      tenantId: session.user.tenantId,
      ...query,
    });

    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching OLT devices:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal mengambil data OLT";
    return ApiErrors.internalError(msg);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("olt_devices:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menambah OLT",
      );
    }

    const body = await req.json();
    const validated = createOltDeviceSchema.parse(body);

    const device = await oltDeviceService.create({
      tenantId: session.user.tenantId,
      ...validated,
    });

    return apiSuccess(device, { status: 201 });
  } catch (error) {
    logger.error("Error creating OLT device:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return ApiErrors.badRequest("Data tidak valid", { details: error });
    }
    const msg = error instanceof Error ? error.message : "Gagal menambah OLT";
    return ApiErrors.internalError(msg);
  }
}
