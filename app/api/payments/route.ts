import { Prisma } from "@prisma/client";
import { paymentSchema } from "@/lib/validations/payment";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import { createPaymentForRoute, listPaymentsForRoute } from "@/modules/finance";

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl;

  return apiSuccess(
    await listPaymentsForRoute({
      filters: {
        pelangganId: searchParams.get("pelangganId"),
        invoiceId: searchParams.get("invoiceId"),
        paymentMethod: searchParams.get("paymentMethod"),
        startDate: searchParams.get("startDate"),
        endDate: searchParams.get("endDate"),
        page: parseInt(searchParams.get("page") || "1"),
        limit: parseInt(searchParams.get("limit") || "20"),
      },
    }),
  );
});

export const POST = createHandler(
  {
    auth: true,
    schema: paymentSchema,
  },
  async (_req, ctx) => {
    try {
      const result = await createPaymentForRoute({
        input: ctx.validated,
        user: { id: ctx.session!.user.id },
      });

      if (result.status === "pelanggan-not-found") {
        return ApiErrors.notFound("Pelanggan tidak ditemukan");
      }

      if (result.status === "invoice-not-found") {
        return ApiErrors.notFound("Invoice tidak ditemukan");
      }

      return apiSuccess(result.data, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating payment:", error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return apiError(
          "Pelanggan atau Invoice tidak ditemukan",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      return ApiErrors.internalError(
        error instanceof Error ? error.message : "Terjadi kesalahan server",
      );
    }
  },
);
