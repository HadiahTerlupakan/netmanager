import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltVlanService, createVlanConfigSchema } from "@/modules/olt";

const vlanService = new OltVlanService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_vlan:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const configs = await vlanService.getVlanConfigs(id, session.user.tenantId);
    return apiSuccess(configs);
  } catch (error) {
    logger.error("Error fetching VLAN configs:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal mengambil VLAN config";
    return ApiErrors.internalError(msg);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_vlan:create"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const body = await req.json();
    const validated = createVlanConfigSchema.parse({ ...body, oltId: id });

    const config = await vlanService.createVlanConfig({
      tenantId: session.user.tenantId,
      ...validated,
    });

    return apiSuccess(config, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error creating VLAN config:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal membuat VLAN config";
    return ApiErrors.internalError(msg);
  }
}

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_vlan:delete"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const configId = searchParams.get("configId");
    if (!configId) return ApiErrors.badRequest("configId wajib diisi");

    await vlanService.deleteVlanConfig(configId, session.user.tenantId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting VLAN config:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal menghapus VLAN config";
    return ApiErrors.internalError(msg);
  }
}
