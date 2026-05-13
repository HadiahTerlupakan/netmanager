import { revalidatePath } from "next/cache";
import { apiSuccess, ApiErrors, createHandler, apiError } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import {
  PelangganAdminMutationError,
  PelangganAdminMutationService,
  PelangganAdminQueryService,
} from "@/modules/pelanggan";
import { canAccessSite } from "@/modules/roles";

const pelangganAdminQueryService = new PelangganAdminQueryService();
const pelangganAdminMutationService = new PelangganAdminMutationService();
const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "on", "yes"]);
const CUSTOMER_ROLE = "CUSTOMER";

/** Parse boolean flag from form data with default fallback. */
const parseBooleanFlag = (
  value: FormDataEntryValue | null,
  defaultValue = false,
) => {
  if (value === null) return defaultValue;
  if (typeof value === "string")
    return BOOLEAN_TRUE_VALUES.has(value.toLowerCase());
  return defaultValue;
};

/** Check whether current session can access pelanggan site. */
const canAccessPelangganBySite = (
  session: { user: { role?: string | null; isSuperAdmin?: boolean } },
  siteId: string | null | undefined,
) => {
  if (!session.user.role || isSuperAdmin(session.user)) return true;
  return canAccessSite(session as never, "pelanggan", siteId);
};

/** Check whether current session can access requested pelanggan id. */
const canAccessPelangganOwnership = (
  user: { id: string; role?: string | null },
  pelangganId: string,
) => {
  if (user.role !== CUSTOMER_ROLE) return true;
  return user.id === pelangganId;
};

/** Handle pelanggan PPP detail request. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;
  const session = ctx.session!;
  if (!canAccessPelangganOwnership(session.user, id)) {
    return ApiErrors.forbidden(
      "Anda tidak diperbolehkan melihat data pelanggan lain",
    );
  }

  const result = await pelangganAdminQueryService.getPppDetail(
    id,
    session.user.tenantId ?? null,
  );
  if (!result) return ApiErrors.notFound("Pelanggan");
  if (!canAccessPelangganBySite(session as never, result.pelanggan.siteId)) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses ke pelanggan di site ini",
    );
  }

  return apiSuccess({
    ...result.pelanggan,
    technicalInfo: result.technicalInfo,
  });
});

/** Handle pelanggan PPP update request. */
export const PUT = createHandler(
  { auth: true, permissions: ["pelanggan:update"] },
  async (req, ctx) => {
    const { id } = ctx.params;
    const session = ctx.session!;
    const formData = await req.formData();

    try {
      const upgradeApplyTimeRaw = formData.get("upgradeApplyTime") as
        | string
        | null;
      const upgradeApplyTime: "IMMEDIATE" | "NEXT_CYCLE" =
        upgradeApplyTimeRaw === "NEXT_CYCLE" ? "NEXT_CYCLE" : "IMMEDIATE";

      const pelanggan = await pelangganAdminMutationService.updatePppById({
        id,
        session: session as never,
        upgradeApplyTime,
        data: {
          idPelanggan: formData.get("idPelanggan") as string,
          nama: formData.get("nama") as string,
          username: formData.get("username") as string,
          password: formData.get("password") as string,
          hargaPaketId: formData.get("hargaPaketId") as string,
          tipe: formData.get("tipe") as string | null,
          tanggalAktif: formData.get("tanggalAktif") as string,
          jatuhTempo: formData.get("jatuhTempo") as string,
          status: formData.get("status") as string | null,
          autoIsolir: parseBooleanFlag(formData.get("autoIsolir"), true),
          email: formData.get("email") as string | null,
          siteId: formData.get("siteId") as string | null,
          invoiceAction: formData.get("invoiceAction") as string | null,
          passwordLogin: formData.get("passwordLogin") as string | null,
        },
      });

      revalidatePath("/admin/pelanggan/ppp");
      ctx.validated = { id: pelanggan.id, action: "UPDATE_PII" };
      return apiSuccess(pelanggan);
    } catch (error) {
      if (error instanceof PelangganAdminMutationError) {
        if (error.code === "BAD_REQUEST")
          return apiError(error.message, "VALIDATION_ERROR", { status: 400 });
        if (error.code === "NOT_FOUND") return ApiErrors.notFound("Pelanggan");
        return ApiErrors.forbidden(error.message);
      }
      throw error;
    }
  },
);

/** Handle pelanggan PPP delete request. */
export const DELETE = createHandler(
  { auth: true, permissions: ["pelanggan:delete"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const session = ctx.session!;

    try {
      const pelanggan = await pelangganAdminMutationService.deletePppById({
        id,
        session: session as never,
      });
      revalidatePath("/admin/pelanggan/ppp");
      ctx.validated = {
        id,
        nama: pelanggan.nama,
        username: pelanggan.username,
      };
      return apiSuccess({ message: "Pelanggan berhasil dihapus" });
    } catch (error) {
      if (error instanceof PelangganAdminMutationError) {
        if (error.code === "NOT_FOUND") return ApiErrors.notFound("Pelanggan");
        return ApiErrors.forbidden(error.message);
      }
      throw error;
    }
  },
);
