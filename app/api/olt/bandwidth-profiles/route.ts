import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  BandwidthProfileService,
  createBandwidthProfileSchema,
} from "@/modules/olt";

const bwService = new BandwidthProfileService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const oltId = searchParams.get("oltId");

    const profiles = oltId
      ? await bwService.listByOlt(oltId)
      : await bwService.listByTenant(session.user.tenantId);

    return apiSuccess(profiles);
  } catch (error) {
    logger.error("Error fetching bandwidth profiles:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengambil data";
    return ApiErrors.internalError(msg);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_devices:create"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const body = await req.json();
    const validated = createBandwidthProfileSchema.parse(body);

    const profile = await bwService.create({
      tenantId: session.user.tenantId,
      ...validated,
    });

    return apiSuccess(profile, { status: 201 });
  } catch (error) {
    logger.error("Error creating bandwidth profile:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return ApiErrors.badRequest("Data tidak valid");
    }
    const msg =
      error instanceof Error ? error.message : "Gagal membuat profile";
    return ApiErrors.internalError(msg);
  }
}
