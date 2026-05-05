import { sendInvoiceSchema } from "@/lib/validations/invoice";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { sendInvoiceForRoute } from "@/modules/finance";

export const POST = createHandler(
  {
    auth: true,
    schema: sendInvoiceSchema,
  },
  async (_req, ctx) => {
    const result = await sendInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      input: ctx.validated,
    });

    if (result.status === "not-found") {
      return ApiErrors.notFound("Invoice");
    }

    if (result.status === "not-draft") {
      return apiError(
        "Hanya invoice dengan status DRAFT yang dapat dikirim",
        ErrorCodes.BUSINESS_LOGIC_ERROR,
        { status: 400 },
      );
    }

    if (result.status === "missing-contact") {
      return apiError(
        "Pelanggan tidak memiliki email atau nomor telepon",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (result.status === "missing-email") {
      return apiError(
        "Email pelanggan tidak tersedia",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (result.status === "missing-phone") {
      return apiError(
        "Nomor telepon pelanggan tidak tersedia",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (result.status === "sent") {
      return apiSuccess({
        message: "Invoice berhasil dikirim",
        sentVia: result.sentVia,
      });
    }

    return apiError("Gagal mengirim invoice", ErrorCodes.BUSINESS_LOGIC_ERROR, {
      status: 400,
    });
  },
);
