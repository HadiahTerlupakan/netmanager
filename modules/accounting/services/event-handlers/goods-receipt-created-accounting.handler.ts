import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { resolveGoodsReceiptCreatedCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "GoodsReceiptCreatedAccountingHandler";

interface ItemPayload {
  quantity: number;
  unitPrice: string;
}

/**
 * GRN created → Dr Persediaan / Cr Hutang Usaha.
 *
 * Subtotal jurnal = sum(qty × unitPrice) dari item GRN. PPN tidak di-include
 * di sini supaya jurnal Persediaan murni harga barang. PPN Masukan dicatat
 * terpisah oleh tax handler (jurnal: Dr PPN Masukan / Cr Hutang Usaha).
 */
export async function handleGoodsReceiptCreatedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const goodsReceiptId = requirePayloadString(
    payload.goodsReceiptId,
    "goodsReceiptId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const receivedAt = requirePayloadString(
    payload.receivedAt,
    "receivedAt",
    SOURCE,
  );
  const items = (payload.items as ItemPayload[]) ?? [];

  const subtotal = items
    .reduce((sum, it) => sum + Number(it.unitPrice) * Number(it.quantity), 0)
    .toString();

  if (Number(subtotal) <= 0) {
    logger.warn(`[${SOURCE}] GRN ${goodsReceiptId} subtotal <= 0, skip jurnal`);
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
    const entryDate = new Date(receivedAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { debitCoaId, creditCoaId } =
      await resolveGoodsReceiptCreatedCoa(tenantId);

    await postingService.postAuto(tenantId, {
      source: "AUTO_GRN_CREATED",
      sourceRefType: "GoodsReceipt",
      sourceRefId: goodsReceiptId,
      entryDate,
      description: `Jurnal otomatis: GRN ${goodsReceiptId} diterima`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: subtotal },
        { coaId: creditCoaId, side: "CREDIT", amount: subtotal },
      ],
    });

    logger.info(
      `[${SOURCE}] Journal posted for GRN ${goodsReceiptId} (Rp ${subtotal})`,
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
