import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { InvoiceStatus } from "@prisma/client-billing";
import { createHandler, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  deleteInvoiceForRoute,
  getInvoiceForRoute,
  updateInvoiceForRoute,
} from "@/modules/finance";

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
  status: z.enum(InvoiceStatus).optional(),
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

export const GET = createHandler(
  { auth: true },
  async (_req: NextRequest, ctx) => {
    const invoice = await getInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      isRestricted: await canOnlyAccessOwnSite(ctx.session!.user),
    });

    if (!invoice) {
      return ApiErrors.notFound("Invoice");
    }

    return NextResponse.json(invoice);
  },
);

export const PUT = createHandler(
  { auth: true },
  async (req: NextRequest, ctx) => {
    const body = await req.json();
    const validatedData = updateSchema.parse(body);
    const result = await updateInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      isRestricted: await canOnlyAccessOwnSite(ctx.session!.user),
      input: validatedData,
    });

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
  { auth: true },
  async (_req: NextRequest, ctx) => {
    const deleted = await deleteInvoiceForRoute({
      invoiceId: ctx.params.id,
      user: ctx.session!.user,
      isRestricted: await canOnlyAccessOwnSite(ctx.session!.user),
    });

    if (!deleted) {
      return ApiErrors.notFound("Invoice");
    }

    return NextResponse.json({ message: "Invoice deleted successfully" });
  },
);

async function canOnlyAccessOwnSite(user: { role?: string | null }) {
  return (
    (await hasPermission("invoice:site_only")) && user.role !== "SUPER_ADMIN"
  );
}
