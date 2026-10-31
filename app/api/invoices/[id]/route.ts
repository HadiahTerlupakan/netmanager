import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { createHandler, ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import {
  INVOICE_READ_PERMISSIONS,
  INVOICE_WRITE_PERMISSIONS,
  isInvoiceSiteRestricted,
} from "@/lib/api/financial-permissions";
import {
  deleteInvoiceForRoute,
  getInvoiceForRoute,
  updateInvoiceForRoute,
} from "@/modules/finance";

const HTTP_CONFLICT = 409;

const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "OVERDUE",
  "PAID",
  "PARTIAL_PAID",
  "CANCELLED",
] as const;

const updateSchema = z.object({
  invoiceNumber: z.string().optional(),
  pelangganId: z.string().optional(),
  siteId: z.string().optional().nullable(),
  issueDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  dueDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  subtotal: z.number().optional(),
  taxAmount: z.number().optional(),
  discountAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  invoiceItem: z
    .array(
      z.object({
        id: z.string().optional(),
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        totalPrice: z.number(),
      }),
    )
    .optional(),
});

/**
 * Penolakan layanan (tagihan sedang dibayar atau sudah menerima uang, checkout
 * pelanggan sedang diproses) dijawab 409 dengan pesannya untuk admin; galat
 * lain diteruskan ke createHandler.
 */
function refusalResponse(error: unknown) {
  if (isRouteServiceError(error) && error.status === HTTP_CONFLICT) {
    return ApiErrors.conflict(error.message);
  }
  throw error;
}

export const GET = createHandler(
  { auth: true, permissions: INVOICE_READ_PERMISSIONS },
  async (_req: NextRequest, ctx) => {
    const invoice = await getInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      isRestricted: isInvoiceSiteRestricted({
        permissions: ctx.permissions,
        user: ctx.session!.user,
      }),
    });

    if (!invoice) {
      return ApiErrors.notFound("Invoice");
    }

    return NextResponse.json(invoice);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: INVOICE_WRITE_PERMISSIONS },
  async (req: NextRequest, ctx) => {
    const body = await req.json();
    const validatedData = updateSchema.parse(body);
    const result = await updateInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      isRestricted: isInvoiceSiteRestricted({
        permissions: ctx.permissions,
        user: ctx.session!.user,
      }),
      input: validatedData,
    }).catch(refusalResponse);

    if (result instanceof NextResponse) {
      return result;
    }

    if (!result) {
      return ApiErrors.notFound("Invoice");
    }

    if (result === "forbidden-site") {
      return ApiErrors.forbidden("Akses ditolak untuk mengubah site");
    }

    return NextResponse.json(result);
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: INVOICE_WRITE_PERMISSIONS },
  async (_req: NextRequest, ctx) => {
    const deleted = await deleteInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      isRestricted: isInvoiceSiteRestricted({
        permissions: ctx.permissions,
        user: ctx.session!.user,
      }),
    }).catch(refusalResponse);

    if (deleted instanceof NextResponse) {
      return deleted;
    }

    if (!deleted) {
      return ApiErrors.notFound("Invoice");
    }

    return NextResponse.json({ message: "Invoice deleted successfully" });
  },
);
