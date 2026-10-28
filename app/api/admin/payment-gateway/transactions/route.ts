import { apiSuccess, createHandler } from "@/lib/api";
import { listPaymentGatewayTransactions } from "@/modules/finance";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function date(value: unknown, endOfDay = false) {
  const raw = text(value);
  if (!raw) return undefined;
  const parsed = new Date(
    `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00"}+07:00`,
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Pemantauan pembayaran pelanggan lewat payment gateway. */
export const GET = createHandler(
  { auth: true, permissions: ["payment_gateway:read"] },
  async (_req, ctx) => {
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(ctx.query.limit) || DEFAULT_LIMIT),
    );

    const result = await listPaymentGatewayTransactions({
      status: text(ctx.query.status),
      method: text(ctx.query.method),
      invoiceId: text(ctx.query.invoiceId),
      search: text(ctx.query.search),
      // Tanggal dari form admin adalah tanggal WIB.
      from: date(ctx.query.from),
      to: date(ctx.query.to, true),
      page,
      limit,
    });

    return apiSuccess({ ...result, page, limit });
  },
);
