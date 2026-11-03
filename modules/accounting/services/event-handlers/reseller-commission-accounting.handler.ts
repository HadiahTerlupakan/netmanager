import type { Job } from "bullmq";
import * as z from "zod";
import { logger } from "@/lib/logger";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "../../errors";
import {
  postResellerCommissionAccrual,
  postResellerSettlementPayment,
  reverseResellerCommissionAccrual,
} from "../journal/reseller-commission-journals";

const SOURCE = "ResellerCommissionAccountingHandler";

/**
 * tenantId wajib: worker berjalan di system context, dan jurnal tanpa tenant
 * bisa tercatat di buku tenant lain. Payload tanpa tenant ditolak.
 */
const tenantIdSchema = z.string().min(1);
const amountSchema = z.number().int().positive();

const accruedSchema = z.object({
  tenantId: tenantIdSchema,
  commissionId: z.string().min(1),
  accrualRef: z.string().min(1),
  invoiceId: z.string().min(1),
  amount: amountSchema,
  accruedAt: z.string().min(1),
});

const cancelledSchema = z.object({
  tenantId: tenantIdSchema,
  accrualRef: z.string().min(1),
  invoiceId: z.string().min(1),
});

const settlementPaidSchema = z.object({
  tenantId: tenantIdSchema,
  settlementId: z.string().min(1),
  amount: amountSchema,
  paidAt: z.string().min(1),
  accountId: z.string().min(1),
});

function parsePayload<T>(schema: z.ZodType<T>, job: Job<EventJobData>): T {
  const parsed = schema.safeParse(job.data.payload);
  if (!parsed.success) {
    throw new Error(
      `[${SOURCE}] Payload ${job.data.eventName} tidak valid: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/** Tenant tanpa COA di-skip seperti handler jurnal lain; galat lain di-retry. */
async function skipWhenCoaMissing(
  tenantId: string,
  post: () => Promise<unknown>,
): Promise<void> {
  try {
    await post();
  } catch (error) {
    if (!(error instanceof CoaNotFoundError)) throw error;
    logger.warn(
      `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}, skipping: ${error.message}`,
    );
  }
}

/** RESELLER_COMMISSION_ACCRUED → Dr Beban Komisi Reseller / Cr Utang Komisi Reseller. */
export async function handleResellerCommissionAccruedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const payload = parsePayload(accruedSchema, job);
  await skipWhenCoaMissing(payload.tenantId, () =>
    postResellerCommissionAccrual({
      tenantId: payload.tenantId,
      commissionId: payload.commissionId,
      accrualRef: payload.accrualRef,
      invoiceId: payload.invoiceId,
      amount: payload.amount,
      accruedAt: new Date(payload.accruedAt),
    }),
  );
}

/** RESELLER_COMMISSION_CANCELLED → balik jurnal akru komisinya. */
export async function handleResellerCommissionCancelledAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const payload = parsePayload(cancelledSchema, job);
  await skipWhenCoaMissing(payload.tenantId, () =>
    reverseResellerCommissionAccrual(payload),
  );
}

/** RESELLER_SETTLEMENT_PAID → Dr Utang Komisi Reseller / Cr Kas/Bank. */
export async function handleResellerSettlementPaidAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const payload = parsePayload(settlementPaidSchema, job);
  await skipWhenCoaMissing(payload.tenantId, () =>
    postResellerSettlementPayment({
      tenantId: payload.tenantId,
      settlementId: payload.settlementId,
      amount: payload.amount,
      paidAt: new Date(payload.paidAt),
      accountId: payload.accountId,
    }),
  );
}
