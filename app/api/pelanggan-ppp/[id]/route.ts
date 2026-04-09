import { revalidatePath } from "next/cache";

import { apiSuccess, ApiErrors, createHandler, apiError } from "@/lib/api";
import {
  PelangganAdminMutationError,
  PelangganAdminMutationService,
  PelangganAdminQueryService,
} from "@/modules/pelanggan";
import { canAccessSite } from "@/modules/roles";

const pelangganAdminQueryService = new PelangganAdminQueryService();
const pelangganAdminMutationService = new PelangganAdminMutationService();

const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "on", "yes"]);

const parseBooleanFlag = (
  value: FormDataEntryValue | null,
  defaultValue = false,
): boolean => {
  if (value === null) return defaultValue;
  if (typeof value === "string")
    return BOOLEAN_TRUE_VALUES.has(value.toLowerCase());
  return defaultValue;
};

const getTenantScopedWhereById = (
  session: {
    user: {
      tenantId?: string | null;
      isSuperAdmin?: boolean | null;
      role?: string | null;
    };
  },
  id: string,
) => {
  const tenantId = session.user.tenantId ?? null;
  const isSuperAdmin = Boolean(
    session.user.isSuperAdmin || session.user.role === "SUPER_ADMIN",
  );

  if (!tenantId && !isSuperAdmin) {
    return {
      where: null,
      error: ApiErrors.forbidden("Akses ditolak: tenant tidak teridentifikasi"),
    };
  }

  return {
    where: tenantId ? { id, tenantId } : { id },
    error: null as ReturnType<typeof ApiErrors.forbidden> | null,
  };
};

const canAccessPelangganBySite = (
  session: { user: { role?: string | null } },
  siteId: string | null | undefined,
) => {
  if (!session.user.role || session.user.role === "SUPER_ADMIN") return true;
  return canAccessSite(
    session as Parameters<typeof canAccessSite>[0],
    "pelanggan",
    siteId,
  );
};

/**
 * GET /api/pelanggan-ppp/{id}
 * Support for Read-Audit and Admin/Customer Auth.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;
  const session = ctx.session!;

  if (session.user.role === "CUSTOMER" && session.user.id !== id) {
    return ApiErrors.forbidden(
      "Anda tidak diperbolehkan melihat data pelanggan lain",
    );
  }

  const tenantScope = getTenantScopedWhereById(
    session as Parameters<typeof getTenantScopedWhereById>[0],
    id,
  );
  if (tenantScope.error) return tenantScope.error;

  const result = await pelangganAdminQueryService.getPppDetail(
    id,
    session.user.tenantId ?? null,
  );
  if (!result) return ApiErrors.notFound("Pelanggan");

  const { pelanggan, technicalInfo } = result;

  if (
    !canAccessPelangganBySite(
      session as Parameters<typeof canAccessPelangganBySite>[0],
      pelanggan.siteId,
    )
  ) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses ke pelanggan di site ini",
    );
  }

  return apiSuccess({
    ...pelanggan,
    technicalInfo,
  });
});

/**
 * PUT /api/pelanggan-ppp/{id}
 */
export const PUT = createHandler(
  { auth: true, permissions: ["pelanggan:update"] },
  async (req, ctx) => {
    const { id } = ctx.params;
    const session = ctx.session!;

    const formData = await req.formData();

    try {
      const pelanggan = await pelangganAdminMutationService.updatePppById({
        id,
        session: session as Parameters<
          typeof pelangganAdminMutationService.updatePppById
        >[0]["session"],
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
        if (error.code === "BAD_REQUEST") {
          return apiError(error.message, "VALIDATION_ERROR", { status: 400 });
        }

        if (error.code === "NOT_FOUND") {
          return ApiErrors.notFound("Pelanggan");
        }

        return ApiErrors.forbidden(error.message);
      }

      throw error;
    }
  },
);

/**
 * DELETE /api/pelanggan-ppp/{id}
 */
export const DELETE = createHandler(
  { auth: true, permissions: ["pelanggan:delete"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const session = ctx.session!;

    try {
      const pelanggan = await pelangganAdminMutationService.deletePppById({
        id,
        session: session as Parameters<
          typeof pelangganAdminMutationService.deletePppById
        >[0]["session"],
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
        if (error.code === "NOT_FOUND") {
          return ApiErrors.notFound("Pelanggan");
        }

        return ApiErrors.forbidden(error.message);
      }

      throw error;
    }
  },
);
