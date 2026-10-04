import { logger } from "@/lib/logger";
import { createNotification } from "@/modules/notification";
import type { LegalDocumentEntity } from "../domain/entities/LegalDocument";
import {
  listDeadlines,
  overdueWeekKey,
  reminderThresholdFor,
  toWibDateKey,
  type LegalDeadline,
} from "../domain/legal-rules";
import type { ILegalRepository } from "../domain/ports/ILegalRepository";
import { LegalRepository } from "../repositories/LegalRepository";

/**
 * Pengingat tenggat dokumen legal; dijalankan cron harian dalam konteks sistem.
 *
 * Satu pengingat per tenggat per ambang (H-90/30/7/0), ditambah pengingat
 * mingguan selama dokumen kedaluwarsa. Idempotensinya dijaga `LegalReminderLog`,
 * jadi cron yang berjalan ulang tidak mengirim dobel.
 */

const NOTIFICATION_SOURCE_TYPE = "LEGAL_DOCUMENT";
const URGENT_THRESHOLDS = new Set(["H7", "H0"]);

/** Ambang yang berlaku untuk satu tenggat hari ini, atau null bila belum/tidak perlu. */
function thresholdForToday(deadline: LegalDeadline, now: Date): string | null {
  if (deadline.daysLeft < 0) {
    return deadline.kind === "END" ? overdueWeekKey(now) : null;
  }

  return reminderThresholdFor(deadline.daysLeft);
}

function describeTiming(daysLeft: number): string {
  if (daysLeft > 0) return `dalam ${daysLeft} hari`;
  if (daysLeft === 0) return "hari ini";

  return `sudah lewat ${-daysLeft} hari`;
}

/** PIC dan pembuat dokumen — bagi admin yang merangkap legal, keduanya kerap orang yang sama. */
function recipientsOf(document: LegalDocumentEntity): string[] {
  return [...new Set([document.pic?.id, document.createdById].filter(Boolean))] as string[];
}

export class LegalReminderService {
  constructor(
    private readonly repository: ILegalRepository = new LegalRepository(),
  ) {}

  /** Kirim pengingat yang jatuh tempo hari ini; mengembalikan jumlah pengingat terkirim. */
  async run(now: Date = new Date()): Promise<number> {
    const documents = await this.repository.findMonitoredDocuments({
      canViewConfidential: true,
    });
    let sentCount = 0;

    for (const document of documents) {
      try {
        sentCount += await this.remindDocument(document, now);
      } catch (error) {
        logger.error(`[LegalReminder] Gagal memproses dokumen ${document.id}:`, error);
      }
    }

    if (sentCount > 0) logger.info(`[LegalReminder] ${sentCount} pengingat terkirim`);
    return sentCount;
  }

  private async remindDocument(document: LegalDocumentEntity, now: Date): Promise<number> {
    let sentCount = 0;

    for (const deadline of listDeadlines(document, now)) {
      const threshold = thresholdForToday(deadline, now);
      if (!threshold) continue;

      const isNew = await this.repository.recordReminder({
        documentId: document.id,
        deadlineKey: deadline.key,
        threshold,
        tenantId: document.tenantId,
      });
      if (!isNew) continue;

      await this.notify(document, deadline, threshold);
      sentCount++;
    }

    return sentCount;
  }

  private async notify(
    document: LegalDocumentEntity,
    deadline: LegalDeadline,
    threshold: string,
  ): Promise<void> {
    const isUrgent = URGENT_THRESHOLDS.has(threshold) || deadline.daysLeft < 0;

    for (const userId of recipientsOf(document)) {
      await createNotification({
        type: "SYSTEM",
        priority: isUrgent ? "HIGH" : "NORMAL",
        title: `Legal: ${deadline.label}`,
        message: `${document.title} — ${toWibDateKey(deadline.date)} (${describeTiming(deadline.daysLeft)})`,
        link: `/admin/legal/dokumen/${document.id}`,
        userId,
        sourceType: NOTIFICATION_SOURCE_TYPE,
        sourceId: document.id,
        tenantId: document.tenantId ?? undefined,
      });
    }
  }
}
