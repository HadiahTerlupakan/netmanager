import { createHandler, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  describeRestockValidationError,
  RESTOCK_JASA_CONFIRM_LIST_LABELS,
  restockJasaConfirmSchema,
} from "@/lib/validations/restock";
import {
  confirmRestockJasaItems,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

/** Konfirmasi penyelesaian item jasa pada purchase request restock. */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const { id } = ctx.params;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user,
    purchaseRequestId: id,
    tenantId: user.tenantId as string,
  });
  if (siteDenied) return siteDenied;
  const body = await req.json().catch((): null => null);
  if (!body) return ApiErrors.badRequest(RESTOCK_MESSAGES.unreadableBody);
  const parsed = restockJasaConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(
      describeRestockValidationError(
        parsed.error,
        RESTOCK_JASA_CONFIRM_LIST_LABELS,
      ),
    );
  }

  return confirmRestockJasaItems({
    purchaseRequestId: id,
    items: parsed.data.items.map((item) => ({
      jasaItemId: item.jasaItemId,
      tanggalSelesai: item.tanggalSelesai,
      buktiSelesai: item.buktiSelesai,
    })),
    actorId: user.id as string,
    tenantId: user.tenantId as string,
  });
});
