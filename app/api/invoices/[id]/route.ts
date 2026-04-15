import { NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { prismaBilling } from "@/modules/database";
import type { Prisma as BillingPrisma } from "@prisma/client-billing";
import * as z from "zod";
import { createHandler, ApiErrors, type HandlerContext } from "@/lib/api";
import { InvoiceStatus } from "@prisma/client-billing";
import { hasPermission } from "@/lib/rbac";

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

type InvoiceRouteContext = HandlerContext;

// GET /api/invoices/[id]
export const GET = createHandler(
  { auth: true },
  async (_req: Request, ctx: InvoiceRouteContext) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const invoice = await prismaBilling.invoice.findUnique({
      where: { id },
      include: {
        invoiceItem: true,
        payment: true,
      },
    });

    if (!invoice) {
      return ApiErrors.notFound("Invoice");
    }

    // RBAC: Check site restrictions
    const isRestricted =
      (await hasPermission("invoice:site_only")) && user.role !== "SUPER_ADMIN";

    if (isRestricted) {
      const { prisma: db } = await import("@/modules/database");
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { siteId: true },
      });
      const userSiteId = dbUser?.siteId;

      if (invoice.siteId && userSiteId && invoice.siteId !== userSiteId) {
        return ApiErrors.forbidden("Akses ditolak");
      }
    }

    // Manually stitch pelanggan data
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: invoice.pelangganId },
    });

    // Format for BigInt and include pelanggan
    return NextResponse.json({
      ...invoice,
      pelanggan,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      discountAmount: Number(invoice.discountAmount),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      invoiceItem: invoice.invoiceItem.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payment: invoice.payment.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    });
  },
);

// PUT /api/invoices/[id]
export const PUT = createHandler(
  { auth: true },
  async (req: Request, ctx: InvoiceRouteContext) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const existingInvoice = await prismaBilling.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return ApiErrors.notFound("Invoice");
    }

    const isRestricted =
      (await hasPermission("invoice:site_only")) && user.role !== "SUPER_ADMIN";

    let userSiteId: string | undefined;
    if (isRestricted) {
      const { prisma: db } = await import("@/modules/database");
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { siteId: true },
      });
      userSiteId = dbUser?.siteId || undefined;

      if (
        existingInvoice.siteId &&
        userSiteId &&
        existingInvoice.siteId !== userSiteId
      ) {
        return ApiErrors.forbidden("Akses ditolak");
      }
    }

    const body = await req.json();
    const validatedData = updateSchema.parse(body);

    if (
      validatedData.siteId &&
      userSiteId &&
      validatedData.siteId !== userSiteId
    ) {
      return ApiErrors.forbidden("Akses ditolak untuk mengubah site");
    }

    const { invoiceItem, ...invoiceData } = validatedData;

    const updatedInvoice = await prismaBilling.$transaction(async (tx) => {
      if (invoiceItem && invoiceItem.length > 0) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        await tx.invoiceItem.createMany({
          data: invoiceItem.map((item) => ({
            id: item.id || crypto.randomUUID(),
            invoiceId: id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: BigInt(item.unitPrice),
            totalPrice: BigInt(item.totalPrice),
          })),
        });
      }

      const toBigIntValue = (
        value:
          | number
          | string
          | bigint
          | BillingPrisma.BigIntFieldUpdateOperationsInput
          | undefined,
      ) => {
        if (value === undefined) {
          return undefined;
        }

        if (typeof value === "object") {
          const nextValue = value.set;
          return nextValue === undefined ? undefined : BigInt(nextValue);
        }

        return BigInt(value);
      };

      const updateData: BillingPrisma.InvoiceUpdateInput = {
        ...invoiceData,
      };

      updateData.subtotal = toBigIntValue(updateData.subtotal);
      updateData.taxAmount = toBigIntValue(updateData.taxAmount);
      updateData.discountAmount = toBigIntValue(updateData.discountAmount);
      updateData.totalAmount = toBigIntValue(updateData.totalAmount);

      return tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          invoiceItem: true,
        },
      });
    });

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: updatedInvoice.pelangganId },
    });

    return NextResponse.json({
      ...updatedInvoice,
      pelanggan,
      subtotal: Number(updatedInvoice.subtotal),
      taxAmount: Number(updatedInvoice.taxAmount),
      discountAmount: Number(updatedInvoice.discountAmount),
      totalAmount: Number(updatedInvoice.totalAmount),
      paidAmount: Number(updatedInvoice.paidAmount),
      invoiceItem: updatedInvoice.invoiceItem.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
    });
  },
);

// DELETE /api/invoices/[id]
export const DELETE = createHandler(
  { auth: true },
  async (_req: Request, ctx: InvoiceRouteContext) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const existingInvoice = await prismaBilling.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return ApiErrors.notFound("Invoice");
    }

    const isRestricted =
      (await hasPermission("invoice:site_only")) && user.role !== "SUPER_ADMIN";

    if (isRestricted) {
      const { prisma: db } = await import("@/modules/database");
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { siteId: true },
      });
      const userSiteId = dbUser?.siteId;

      if (
        existingInvoice.siteId &&
        userSiteId &&
        existingInvoice.siteId !== userSiteId
      ) {
        return ApiErrors.forbidden("Akses ditolak");
      }
    }

    await prismaBilling.invoice.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Invoice deleted successfully" });
  },
);
