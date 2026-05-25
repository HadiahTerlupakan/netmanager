import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { resolveGoodsReturnSentCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "GoodsReturnSentAccountingHandler";

interface ItemPayload {
  goodsReceiptItemId: string;
  quantity: number;
}

/**
 * RTV sent → Dr Hutang Usaha / Cr Persediaan.
 *
 * Karena payload RTV tidak include unitPrice (untuk hindari leak data),
 * lookup harga dari `GoodsReceiptItem` → `PurchaseOrderItem.unitPrice`
 * via Prisma. Subtotal = sum(qty × unitPrice).
 */
export async function handleGoodsReturnSentAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const goodsReturnId = requirePayloadString(
    payload.goodsReturnId,
    "goodsReturnId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const returnedAt = requirePayloadString(
    payload.returnedAt,
    "returnedAt",
    SOURCE,
  );
  const items = (payload.items as ItemPayload[]) ?? [];

  let subtotalNum = 0;
  for (const item of items) {
    if (!item.goodsReceiptItemId || !item.quantity) continue;
    const grnItem = await prisma.goodsReceiptItem.findUnique({
      where: { id: item.goodsReceiptItemId },
      select: { purchaseOrderItem: { select: { unitPrice: true } } },
    });
    const unitPrice = grnItem?.purchaseOrderItem?.unitPrice ?? 0;
    subtotalNum += Number(unitPrice) * Number(item.quantity);
  }
  const subtotal = subtotalNum.toString();

  if (subtotalNum <= 0) {
    logger.warn(`[${SOURCE}] RTV ${goodsReturnId} subtotal <= 0, skip jurnal`);
    return;
  }

  try {
    const journalRepo = new JournalRepository();
    const coaRepo = new ChartOfAccountRepository();
    const periodRepo = new PeriodRepository();
    const numberGen = new JournalNumberGenerator(journalRepo);
    const postingService = new JournalPostingService(
      journalRepo,
      coaRepo,
      periodRepo,
      numberGen,
    );

    const periodService = new PeriodService(periodRepo);
    const entryDate = new Date(returnedAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { debitCoaId, creditCoaId } =
      await resolveGoodsReturnSentCoa(tenantId);

    await postingService.postAuto(tenantId, {
      source: "AUTO_RTV_SENT",
      sourceRefType: "GoodsReturn",
      sourceRefId: goodsReturnId,
      entryDate,
      description: `Jurnal otomatis: RTV ${goodsReturnId} dikirim ke vendor`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: subtotal },
        { coaId: creditCoaId, side: "CREDIT", amount: subtotal },
      ],
    });

    logger.info(
      `[${SOURCE}] Journal posted for RTV ${goodsReturnId} (Rp ${subtotal})`,
    );
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(
        `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}: ${error.message}`,
      );
      return;
    }
    throw error;
  }
}
