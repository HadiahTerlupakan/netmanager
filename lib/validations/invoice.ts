import * as z from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Deskripsi item harus diisi"),
  quantity: z.number().min(1, "Quantity minimal 1").default(1),
  unitPrice: z.number().min(0, "Harga satuan minimal 0"),
  itemType: z
    .enum([
      "SERVICE",
      "PRODUCT",
      "SETUP_FEE",
      "MONTHLY_FEE",
      "ONE_TIME_FEE",
      "OTHER",
    ])
    .default("SERVICE"),
});

const invoiceBaseSchema = z.object({
  pelangganId: z.string().min(1, "Pelanggan harus dipilih"),
  issueDate: z
    .string()
    .min(1, "Tanggal issue harus diisi")
    .transform((val) => new Date(val)),
  dueDate: z
    .string()
    .min(1, "Tanggal jatuh tempo harus diisi")
    .transform((val) => new Date(val)),
  status: z
    .enum(["DRAFT", "SENT", "OVERDUE", "PAID", "CANCELLED"])
    .default("DRAFT"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxAmount: z.number().min(0, "Jumlah pajak minimal 0").default(0),
  discountAmount: z.number().min(0, "Jumlah diskon minimal 0").default(0),
  items: z.array(invoiceItemSchema).min(1, "Minimal harus ada 1 item"),
  siteId: z.string().optional(),
});

export const invoiceSchema = invoiceBaseSchema.refine(
  (data) => {
    // Validate due date is after issue date
    if (data.dueDate <= data.issueDate) {
      return false;
    }
    return true;
  },
  {
    message: "Tanggal jatuh tempo harus setelah tanggal issue",
    path: ["dueDate"],
  },
);

export const updateInvoiceSchema = invoiceBaseSchema
  .partial()
  .omit({ pelangganId: true });

export const sendInvoiceSchema = z.object({
  recipientEmail: z.email({ error: "Email tidak valid" }).optional(),
  recipientPhone: z.string().optional(),
  message: z.string().optional(),
  sendMethod: z.enum(["EMAIL", "WHATSAPP", "BOTH"]).default("EMAIL"),
});

export type InvoiceSchema = z.infer<typeof invoiceSchema>;
export type UpdateInvoiceSchema = z.infer<typeof updateInvoiceSchema>;
export type SendInvoiceSchema = z.infer<typeof sendInvoiceSchema>;
export type InvoiceItemSchema = z.infer<typeof invoiceItemSchema>;
