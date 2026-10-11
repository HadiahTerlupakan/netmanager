import {
  createHandler,
  ApiErrors,
  apiError,
  apiSuccess,
  requireSessionTenantId,
} from "@/lib/api";
import {
  planningDocumentService,
  unggahDokumenPlanningSchema,
} from "@/modules/planning";

/**
 * GET /api/planning/[id]/documents
 * List documents untuk planning (stub - belum diimplementasi)
 */
/**
 * Stub endpoint: mengembalikan 501, bukan melempar.
 *
 * `ApiErrors.notImplemented()` menghasilkan `NextResponse`, bukan `Error`.
 * Melemparnya membuat `handleError` gagal mengenalinya — bukan AppError, bukan
 * error Prisma, `message` kosong — sehingga jatuh ke cabang terakhir dan
 * membalas 500 "Terjadi kesalahan pada server". Klien tidak bisa membedakan
 * fitur yang memang belum ada dari server yang rusak, dan monitoring error
 * terus menyala tanpa sebab.
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (_req, _ctx) => {
    return ApiErrors.notImplemented(
      "Document listing not yet implemented. Will be implemented in Task 14.",
    );
  },
);

/**
 * POST /api/planning/[id]/documents
 * Unggah gambar ke planning (multipart: `file`, opsional `nodeId`, `category`,
 * `description`). Dengan `nodeId` menjadi foto survei titik rencananya.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (req, ctx) => {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiError("Berkas wajib diisi", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    const fields = unggahDokumenPlanningSchema.parse({
      nodeId: formData.get("nodeId") || null,
      category: formData.get("category") || undefined,
      description: formData.get("description") || null,
    });

    const dokumen = await planningDocumentService.upload(
      ctx.params.id,
      { file, ...fields },
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(dokumen, {
      status: 201,
      message: "Dokumen berhasil diunggah",
    });
  },
);
