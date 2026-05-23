import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltCardService, updateOltCardSchema } from "@/modules/olt";

const cardService = new OltCardService();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_cards:update"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id, cardId } = await params;
    const body = await req.json();
    const input = updateOltCardSchema.parse(body);

    const result = await cardService.updateCard(
      session.user.tenantId,
      id,
      cardId,
      input,
    );

    if (result.success === false) {
      const { code, message } = result.error;
      if (code === "OLT_NOT_FOUND" || code === "CARD_NOT_FOUND") {
        return ApiErrors.notFound(message);
      }
      return ApiErrors.internalError(message);
    }

    return apiSuccess(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    return ApiErrors.internalError("Gagal update card");
  }
}
