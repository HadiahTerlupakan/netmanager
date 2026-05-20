import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { SnmpExplorerService } from "@/modules/olt";

const snmpExplorer = new SnmpExplorerService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_devices:update"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const body = await req.json();
    const baseOid = body.oid || "1.3.6.1.2.1.1";

    const result = await snmpExplorer.walkOidTree(id, baseOid);

    if (!result.success) {
      return apiSuccess({ entries: [], error: result.error });
    }
    return apiSuccess({ entries: result.data });
  } catch (error) {
    logger.error("Error SNMP walk:", error);
    const msg = error instanceof Error ? error.message : "SNMP walk gagal";
    return ApiErrors.internalError(msg);
  }
}
