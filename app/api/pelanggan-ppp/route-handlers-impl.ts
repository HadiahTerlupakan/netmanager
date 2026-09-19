import path from "path";
import { Status } from "@prisma/client";
import {
  getPelangganService,
  pelangganInputBuilderService,
  pelangganUploadService,
} from "@/modules/pelanggan";
import { checkSiteRestriction } from "@/modules/roles";
import {
  apiSuccess,
  apiPaginated,
  ApiErrors,
  createHandler,
  apiError,
  buildSessionWithPermissions,
} from "@/lib/api";
import { createPelangganSchema } from "@/lib/validations/pelanggan";
import { logger } from "@/lib/logger";
import * as z from "zod";

/** Remove password fields from pelanggan response payload. */
const sanitizePelangganResponse = <
  T extends { password?: string | null; passwordHash?: string | null },
>(
  pelanggan: T,
) => {
  const {
    password: _password,
    passwordHash: _passwordHash,
    ...safePelanggan
  } = pelanggan;
  return safePelanggan;
};

/**
 * GET /api/pelanggan-ppp
 * Get pelanggan PPP list with pagination
 */
export const GET = createHandler(
  { auth: true, permissions: ["pelanggan:read"] },
  async (req, ctx) => {
    const session = ctx.session!;
    const searchParams = req.nextUrl.searchParams;
    const restriction = checkSiteRestriction(
      buildSessionWithPermissions(session, ctx.permissions),
      "pelanggan",
    );
    const status = searchParams.get("status") as Status | null;
    const search = searchParams.get("search");
    const siteIdParam = searchParams.get("siteId");

    try {
      const filter = pelangganInputBuilderService.buildListFilter(restriction, {
        status,
        search,
        siteIdParam,
      });
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const { data: pelanggans, total } =
        await getPelangganService().getAllPelangganPaginated(
          filter,
          page,
          limit,
        );
      return apiPaginated(pelanggans.map(sanitizePelangganResponse), {
        page,
        limit,
        total,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("akses site")) {
        return ApiErrors.forbidden(error.message);
      }
      throw error;
    }
  },
);

/**
 * POST /api/pelanggan-ppp
 * Create new pelanggan PPP
 */
export const POST = createHandler(
  { auth: true, permissions: ["pelanggan:create"] },
  async (req, ctx) => {
    const session = ctx.session!;
    const formData = await req.formData();
    const rawData = Object.fromEntries(formData.entries());
    if (rawData.siteId === "") rawData.siteId = null;
    if (rawData.odpId === "") rawData.odpId = null;
    if (rawData.resellerId === "") rawData.resellerId = null;
    if (rawData.resellerOutletId === "") rawData.resellerOutletId = null;

    const validationResult = createPelangganSchema.safeParse(rawData);
    if (!validationResult.success) {
      const details = z.flattenError(validationResult.error);
      const firstError =
        Object.values(details.fieldErrors)[0]?.[0] ||
        "Periksa kembali input Anda";
      return apiError(`Validasi Gagal: ${firstError}`, "VALIDATION_ERROR", {
        status: 400,
        details,
      });
    }

    const data = validationResult.data;
    const restriction = checkSiteRestriction(
      buildSessionWithPermissions(session, ctx.permissions),
      "pelanggan",
    );

    let inputWithSite: typeof data;
    try {
      inputWithSite = pelangganInputBuilderService.applySiteRestriction(
        data,
        restriction,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("akses site")) {
        return ApiErrors.forbidden(error.message);
      }
      throw error;
    }

    const pelangganUploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "pelanggan",
      inputWithSite.idPelanggan.trim(),
    );

    // Penyimpanan file dipisah dari pembuatan pelanggan.
    //
    // Sebelumnya keduanya berada dalam satu `try` yang catch-nya selalu
    // membalas "Gagal memproses upload file". Error yang sebenarnya — ID,
    // username, atau email duplikat, "Harga Paket tidak ditemukan", error
    // Prisma — semuanya tersamar jadi pesan upload. Akibat lanjutannya, logika
    // retry duplikat di klien (yang mencocokkan "sudah digunakan"/409) tidak
    // pernah aktif, sehingga ID baru tidak pernah dibuat ulang.
    let savedFiles: {
      fileKTP: string | null;
      fileRumahSekitar: string | null;
      fileBAST: string | null;
    };

    try {
      const fileKTP = formData.get("fileKTP") as File | null;
      const fileRumahSekitar = formData.get("fileRumahSekitar") as File | null;
      const fileBAST = formData.get("fileBAST") as File | null;

      savedFiles = {
        fileKTP: await pelangganUploadService.saveOptionalFile(
          fileKTP,
          pelangganUploadDir,
          "ktp",
          "File KTP tidak valid",
        ),
        fileRumahSekitar: await pelangganUploadService.saveOptionalFile(
          fileRumahSekitar,
          pelangganUploadDir,
          "rumah",
          "File Rumah tidak valid",
        ),
        fileBAST: await pelangganUploadService.saveOptionalFile(
          fileBAST,
          pelangganUploadDir,
          "bast",
          "File BAST tidak valid",
        ),
      };
    } catch (error) {
      logger.error("Error saving files:", error as Error);
      return ApiErrors.internalError("Gagal memproses upload file");
    }

    // Error dari pembuatan pelanggan sengaja dibiarkan naik ke `handleError`,
    // yang sudah memetakan duplikat unique constraint ke 409 dan pesan bisnis
    // ke status yang sesuai.
    const pelanggan = await getPelangganService().createPelanggan({
      ...inputWithSite,
      tenantId: session.user.tenantId ?? null,
      ...savedFiles,
    } as Parameters<
      ReturnType<typeof getPelangganService>["createPelanggan"]
    >[0]);

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/pelanggan/ppp");
    revalidatePath("/api/pelanggan-ppp");
    ctx.validated = {
      id: pelanggan.id,
      idPelanggan: pelanggan.idPelanggan,
      nama: pelanggan.nama,
      username: pelanggan.username,
    };
    return apiSuccess(sanitizePelangganResponse(pelanggan), { status: 201 });
  },
);
