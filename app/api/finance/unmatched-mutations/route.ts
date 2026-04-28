import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors, createHandler, apiPaginated } from "@/lib/api";
import {
  InvoiceNotFoundError,
  MissingInvoiceIdError,
  UnmatchedMutationNotFoundError,
  UnmatchedMutationService,
} from "@/modules/finance";

const service = new UnmatchedMutationService();

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const status = (ctx.query.status as string) || "PENDING";
  const page = parseInt((ctx.query.page as string) || "1");
  const limit = parseInt((ctx.query.limit as string) || "10");

  const { total, mutations } = await service.list({
    status: status as "PENDING" | "RESOLVED" | "IGNORED" | "ALL",
    page,
    limit,
  });

  return apiPaginated(mutations, { total, page, limit });
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const body = await req.json();
  const { mutationId, invoiceId, action } = body;

  if (!mutationId || !action) {
    return ApiErrors.badRequest("Missing required fields (mutationId, action)");
  }

  try {
    if (action === "IGNORE") {
      const mutation = await service.ignore(mutationId, ctx.session!.user.id);
      return apiSuccess({ mutation });
    }

    if (action === "RESOLVE") {
      const result = await service.resolve({
        mutationId,
        invoiceId,
        userId: ctx.session!.user.id,
      });
      return apiSuccess({ payment: result.payment, mutation: result.mutation });
    }

    return ApiErrors.badRequest("Invalid action");
  } catch (error: unknown) {
    if (error instanceof MissingInvoiceIdError) {
      return ApiErrors.badRequest(error.message);
    }
    if (error instanceof UnmatchedMutationNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof InvoiceNotFoundError) {
      return ApiErrors.notFound(error.message);
    }

    logger.error("Unmatched mutation action failed:", error);
    return ApiErrors.internalError("Gagal memproses mutasi");
  }
});
