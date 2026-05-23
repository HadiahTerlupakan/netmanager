import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { SnmpExplorerService } from "@/modules/olt";

const snmpExplorer = new SnmpExplorerService();

const oidSchema = z.object({
  oid: z
    .string()
    .max(200)
    .regex(/^[0-9.]+$/, "OID harus berupa angka dan titik")
    .optional(),
});

const DEFAULT_BASE_OID = "1.3.6.1.2.1.1";

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
    const validated = oidSchema.parse(body);
    const baseOid = validated.oid ?? DEFAULT_BASE_OID;

    const result = await snmpExplorer.walkOidTree(
      id,
      session.user.tenantId,
      baseOid,
    );

    if (!result.success) {
      return apiSuccess({ entries: [], error: result.error });
    }
    return apiSuccess({ entries: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("OID tidak valid");
    }
    logger.error("Error SNMP walk:", error);
    const msg = error instanceof Error ? error.message : "SNMP walk gagal";
    return ApiErrors.internalError(msg);
  }
}
