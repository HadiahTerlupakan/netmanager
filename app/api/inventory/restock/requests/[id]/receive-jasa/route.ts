import { createHandler, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { restockConfirmJasaSchema } from "@/lib/validations/jasa";
import { confirmRestockJasaItems } from "@/modules/inventory";

/** Konfirmasi penyelesaian item jasa pada purchase request restock. */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden("Akses ditolak. Butuh izin restock:verify");
  }

  const { id } = ctx.params;
  const body = await req.json();
  const parsed = restockConfirmJasaSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(parsed.error.issues[0].message);
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
