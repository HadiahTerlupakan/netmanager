import type {
  IRecurringRepository,
  RecurringCreateInput,
} from "../../domain/ports/IRecurringRepository";
import type { RecurringJournalTemplate } from "../../domain/entities/RecurringJournalTemplate";
import { AccountingError } from "../../errors";

export class RecurringService {
  constructor(private readonly recurringRepo: IRecurringRepository) {}

  async create(
    tenantId: string,
    input: Omit<RecurringCreateInput, "tenantId">,
  ): Promise<RecurringJournalTemplate> {
    return this.recurringRepo.create({ ...input, tenantId });
  }

  async update(
    id: string,
    input: Partial<RecurringCreateInput> & { isActive?: boolean },
  ): Promise<RecurringJournalTemplate> {
    const existing = await this.recurringRepo.findById(id);
    if (!existing) {
      throw new AccountingError(
        "Template tidak ditemukan",
        "RECURRING_NOT_FOUND",
      );
    }
    return this.recurringRepo.update(id, input);
  }

  async findById(id: string): Promise<RecurringJournalTemplate | null> {
    return this.recurringRepo.findById(id);
  }

  async list(tenantId: string): Promise<RecurringJournalTemplate[]> {
    return this.recurringRepo.list(tenantId);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.recurringRepo.findById(id);
    if (!existing) {
      throw new AccountingError(
        "Template tidak ditemukan",
        "RECURRING_NOT_FOUND",
      );
    }
    await this.recurringRepo.delete(id);
  }

  previewNextRun(template: RecurringJournalTemplate): Date | null {
    if (!template.isActive) return null;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let nextDate = new Date(year, month, template.dayOfMonth);
    if (nextDate <= now) {
      nextDate = new Date(year, month + 1, template.dayOfMonth);
    }

    if (template.endDate && nextDate > template.endDate) return null;
    return nextDate;
  }
}
