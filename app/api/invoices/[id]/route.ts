import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { prismaBilling } from "@/modules/database";
import * as z from "zod";
import { createHandler, ApiErrors } from "@/lib/api";
import { InvoiceStatus } from "@prisma/client-billing";
import { hasPermission } from "@/lib/rbac";

type InvoiceUpdatePayload = z.infer<typeof updateSchema>;

type InvoiceUpdateData = Omit<
  InvoiceUpdatePayload,
  "invoiceItem" | "subtotal" | "taxAmount" | "discountAmount" | "totalAmount"
> & {
  subtotal?: bigint;
  taxAmount?: bigint;
  discountAmount?: bigint;
  totalAmount?: bigint;
};

type InvoiceResponseShape = {
  pelangganId: string;
  subtotal: bigint;
  taxAmount: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  invoiceItem: Array<{
    unitPrice: bigint;
    totalPrice: bigint;
    [key: string]: unknown;
  }>;
  payment?: Array<{
    amount: bigint;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

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

async function getRestrictedInvoiceOrNotFound(id: string, userId: string) {
  const { prisma: db } = await import("@/modules/database");
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: { siteId: true },
  });
  const userSiteId = dbUser?.siteId;

  if (!userSiteId) {
    return null;
  }

  const invoice = await prismaBilling.invoice.findFirst({
    where: {
      id,
      siteId: userSiteId,
    },
    include: {
      invoiceItem: true,
      payment: true,
    },
  });

  if (!invoice) {
    return null;
  }

  return invoice;
}

async function getInvoiceByAccessMode(
  id: string,
  user: { id: string; role?: string | null },
) {
  const isRestricted =
    (await hasPermission("invoice:site_only")) && user.role !== "SUPER_ADMIN";

  if (isRestricted) {
    return getRestrictedInvoiceOrNotFound(id, user.id);
  }

  return prismaBilling.invoice.findUnique({
    where: { id },
    include: {
      invoiceItem: true,
      payment: true,
    },
  });
}

function formatInvoiceResponse(invoice: InvoiceResponseShape) {
  const payments = invoice.payment ?? [];

  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    invoiceItem: invoice.invoiceItem.map(
      (item: InvoiceResponseShape["invoiceItem"][number]) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      }),
    ),
    payment: payments.map(
      (payment: NonNullable<InvoiceResponseShape["payment"]>[number]) => ({
        ...payment,
        amount: Number(payment.amount),
      }),
    ),
  };
}

// GET /api/invoices/[id]
export const GET = createHandler(
  { auth: true },
  async (_req: NextRequest, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const invoice = await getInvoiceByAccessMode(id, user);

    if (!invoice) {
      return ApiErrors.notFound("Invoice");
    }

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: invoice.pelangganId },
    });

    return NextResponse.json({
      ...formatInvoiceResponse(invoice),
      pelanggan,
    });
  },
);

// PUT /api/invoices/[id]
export const PUT = createHandler(
  { auth: true },
  async (req: NextRequest, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const existingInvoice = await getInvoiceByAccessMode(id, user);

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

    const {
      invoiceItem,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      ...restInvoiceData
    } = validatedData;

    const updateSiteId = isRestricted ? userSiteId : validatedData.siteId;

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

      const updateData: InvoiceUpdateData = {
        ...restInvoiceData,
        ...(isRestricted ? { siteId: updateSiteId } : {}),
        ...(subtotal !== undefined ? { subtotal: BigInt(subtotal) } : {}),
        ...(taxAmount !== undefined ? { taxAmount: BigInt(taxAmount) } : {}),
        ...(discountAmount !== undefined
          ? { discountAmount: BigInt(discountAmount) }
          : {}),
        ...(totalAmount !== undefined
          ? { totalAmount: BigInt(totalAmount) }
          : {}),
      };

      return tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          invoiceItem: true,
          payment: true,
        },
      });
    });

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: updatedInvoice.pelangganId },
    });

    return NextResponse.json({
      ...updatedInvoice,
      pelanggan,
      ...formatInvoiceResponse(updatedInvoice),
    });
  },
);

export const DELETE = createHandler(
  { auth: true },
  async (_req: NextRequest, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const existingInvoice = await getInvoiceByAccessMode(id, user);

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
