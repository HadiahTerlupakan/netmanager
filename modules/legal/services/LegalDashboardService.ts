import type { LegalDocumentEntity } from "../domain/entities/LegalDocument";
import { deriveStatus } from "../domain/legal-rules";
import type {
  ILegalRepository,
  LegalAccess,
} from "../domain/ports/ILegalRepository";
import { actionableDeadlines, toDeadlineDto, type LegalDeadlineDto } from "../dto/legal.dto";
import { LegalRepository } from "../repositories/LegalRepository";

/**
 * Dasbor legal: menjawab "apa yang harus saya urus dalam waktu dekat?" —
 * tenggat dalam 90 hari dan dokumen yang sudah kedaluwarsa, paling mendesak dulu.
 */

const MAX_ACTION_ITEMS = 50;
const THIS_WEEK_DAYS = 7;

export interface LegalActionItemDto extends LegalDeadlineDto {
  documentId: string;
  documentTitle: string;
  categoryName: string | null;
  picName: string | null;
}

export interface LegalDashboardDto {
  soonCount: number;
  expiredCount: number;
  dueThisWeekCount: number;
  actionItems: LegalActionItemDto[];
}

function toActionItems(document: LegalDocumentEntity, now: Date): LegalActionItemDto[] {
  return actionableDeadlines(document, now).map((deadline) => ({
    ...toDeadlineDto(deadline),
    documentId: document.id,
    documentTitle: document.title,
    categoryName: document.category?.name ?? null,
    picName: document.pic?.name ?? null,
  }));
}

export class LegalDashboardService {
  constructor(
    private readonly repository: ILegalRepository = new LegalRepository(),
  ) {}

  /** Ringkasan dan daftar tindakan untuk dasbor legal. */
  async summary(access: LegalAccess, now: Date = new Date()): Promise<LegalDashboardDto> {
    const documents = await this.repository.findMonitoredDocuments(access);
    const statuses = documents.map((document) => deriveStatus(document, now));
    const actionItems = documents
      .flatMap((document) => toActionItems(document, now))
      .sort((left, right) => left.daysLeft - right.daysLeft);

    return {
      soonCount: statuses.filter((status) => status === "SEGERA_BERAKHIR").length,
      expiredCount: statuses.filter((status) => status === "KEDALUWARSA").length,
      dueThisWeekCount: actionItems.filter(
        (item) => item.daysLeft >= 0 && item.daysLeft <= THIS_WEEK_DAYS,
      ).length,
      actionItems: actionItems.slice(0, MAX_ACTION_ITEMS),
    };
  }
}
