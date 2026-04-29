import { logger } from "@/lib/logger";
import {
  convertAndSaveImage,
  saveFile,
  isImageFile,
} from "@/lib/utils/image-upload";
import path from "path";
import { getPelangganService } from "@/modules/pelanggan";
import { checkSiteRestriction } from "@/modules/roles";
import {
  apiSuccess,
  apiPaginated,
  ApiErrors,
  createHandler,
  apiError,
} from "@/lib/api";
import { createPelangganSchema } from "@/lib/validations/pelanggan";
import { validateFileSignature } from "@/lib/utils/file-validation";
import * as z from "zod";

type CustomerStatusValue =
  | "AKTIF"
  | "NONAKTIF"
  | "MAINTENANCE"
  | "ISOLIR"
  | "DISMANTLE";
type SiteInFilter = { in: string[] };
type FilterOptions = {
  status?: CustomerStatusValue;
  search?: string;
  siteId?: string | SiteInFilter;
};
const ALLOWED_TYPES: ("jpg" | "png" | "pdf")[] = ["jpg", "png", "pdf"];

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

/** Handle pelanggan PPP list request. */
export const GET = createHandler(
  { auth: true, permissions: ["pelanggan:read"] },
  async (req, ctx) => {
    const session = ctx.session!;
    const searchParams = req.nextUrl.searchParams;
    const { isRestricted, siteIds } = checkSiteRestriction(
      session as never,
      "pelanggan",
    );
    const filter: FilterOptions = {};
    const status = searchParams.get("status") as CustomerStatusValue | null;
    if (status) filter.status = status;
    if (searchParams.get("search")) filter.search = searchParams.get("search")!;
    if (isRestricted) {
      if (siteIds.length === 0)
        return ApiErrors.forbidden("User tidak memiliki akses site");
      filter.siteId = { in: siteIds };
    } else if (searchParams.get("siteId")) {
      filter.siteId = searchParams.get("siteId")!;
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const { data: pelanggans, total } =
      await getPelangganService().getAllPelangganPaginated(filter, page, limit);
    return apiPaginated(pelanggans.map(sanitizePelangganResponse), {
      page,
      limit,
      total,
    });
  },
);

/** Handle pelanggan PPP create request. */
export const POST = createHandler(
  { auth: true, permissions: ["pelanggan:create"] },
  async (req, ctx) => {
    const session = ctx.session!;
    const formData = await req.formData();
    const rawData = Object.fromEntries(formData.entries());
    if (rawData.siteId === "") rawData.siteId = null;
    if (rawData.odpId === "") rawData.odpId = null;

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
    const restriction = checkSiteRestriction(session as never, "pelanggan");
    if (restriction.isRestricted) {
      if (!restriction.primarySiteId)
        return ApiErrors.forbidden("User tidak memiliki akses site");
      data.siteId = restriction.primarySiteId;
    }

    const pelangganUploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "pelanggan",
      data.idPelanggan.trim(),
    );
    try {
      const fileKTP = formData.get("fileKTP") as File | null;
      const fileRumahSekitar = formData.get("fileRumahSekitar") as File | null;
      const fileBAST = formData.get("fileBAST") as File | null;
      const pelanggan = await getPelangganService().createPelanggan({
        ...data,
        fileKTP: await saveOptionalFile(
          fileKTP,
          pelangganUploadDir,
          "ktp",
          "File KTP tidak valid",
        ),
        fileRumahSekitar: await saveOptionalFile(
          fileRumahSekitar,
          pelangganUploadDir,
          "rumah",
          "File Rumah tidak valid",
        ),
        fileBAST: await saveOptionalFile(
          fileBAST,
          pelangganUploadDir,
          "bast",
          "File BAST tidak valid",
        ),
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
    } catch (error) {
      logger.error("Error saving files:", error);
      return ApiErrors.internalError("Gagal memproses upload file");
    }
  },
);

/** Save one optional pelanggan attachment after file validation. */
async function saveOptionalFile(
  file: File | null,
  uploadDir: string,
  filePrefix: string,
  errorMessage: string,
) {
  if (!file || file.size <= 0) return null;
  if (!(await validateFileSignature(file, ALLOWED_TYPES)))
    throw new Error(errorMessage);
  if (isImageFile(file))
    return convertAndSaveImage(file, uploadDir, filePrefix);
  return saveFile(
    file,
    uploadDir,
    `${filePrefix}${path.extname(file.name) || ".pdf"}`,
  );
}
