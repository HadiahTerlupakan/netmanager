import { createHandler, apiSuccess, apiError } from "@/lib/api";
import { buildTenantContext, createMapCsvImportService } from "@/modules/map";

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Import map nodes from CSV (merge mode).
 * Expected columns: name, latitude, longitude, area?, owner?, notes?, type?
 * Type auto-detected from name prefix (ODP/ODC/OLT/ONT); default odp.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["map:create", "map:update"],
  },
  async (req, ctx) => {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("File CSV wajib diunggah", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    if (file.size === 0) {
      return apiError("File CSV kosong", "VALIDATION_ERROR", { status: 400 });
    }

    if (file.size > MAX_CSV_SIZE_BYTES) {
      return apiError(
        `Ukuran file maksimal ${MAX_CSV_SIZE_BYTES / 1024 / 1024}MB`,
        "VALIDATION_ERROR",
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && file.type !== "text/csv") {
      return apiError("File harus berformat CSV", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    const csvContent = await file.text();
    if (!csvContent.trim()) {
      return apiError("Konten CSV kosong", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    const tenantCtx = buildTenantContext(ctx.session?.user);
    const service = createMapCsvImportService();
    const summary = await service.importFromCsv(tenantCtx, csvContent);

    if (
      summary.created === 0 &&
      summary.updated === 0 &&
      summary.errors.length > 0
    ) {
      return apiError(
        summary.errors[0]?.error || "Gagal mengimpor CSV",
        "VALIDATION_ERROR",
        {
          status: 400,
          details: {
            summary: {
              totalRows: summary.totalRows,
              created: summary.created,
              updated: summary.updated,
              skipped: summary.skipped,
              errors: summary.errors,
            },
          },
        },
      );
    }

    return apiSuccess({
      message: `Import selesai: ${summary.created} baru, ${summary.updated} diupdate, ${summary.skipped} dilewati`,
      summary: {
        totalRows: summary.totalRows,
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        errors: summary.errors,
        results: summary.results,
      },
    });
  },
);
