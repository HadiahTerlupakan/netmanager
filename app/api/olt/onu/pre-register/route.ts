import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltOnuService, preRegisterSchema } from "@/modules/olt";

const onuService = new OltOnuService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);

    const result = await onuService.listPreRegistrations(
      session.user.tenantId,
      page,
      limit,
    );
    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching pre-registrations:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengambil data";
    return ApiErrors.internalError(msg);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:create"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const body = await req.json();
    const validated = preRegisterSchema.parse(body);

    const existing = await onuService.findPendingPreRegistration(
      session.user.tenantId,
      validated.serialNumber,
    );
    if (existing) {
      return ApiErrors.badRequest("Serial number sudah di-pre-register");
    }

    const record = await onuService.createPreRegistration({
      tenantId: session.user.tenantId,
      ...validated,
      createdBy: session.user.id,
    });

    return apiSuccess(record, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error creating pre-registration:", error);
    const msg = error instanceof Error ? error.message : "Gagal pre-register";
    return ApiErrors.internalError(msg);
  }
}
