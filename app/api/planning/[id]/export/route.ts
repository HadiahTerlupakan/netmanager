import { createHandler, ApiErrors } from "@/lib/api";

/**
 * GET /api/planning/[id]/export
 * Export planning to PDF (stub - belum diimplementasi)
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
      "PDF export not yet implemented. Will be implemented in Task 26 with PDF generation library.",
    );
  },
);
