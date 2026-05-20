import type {
  RecurringJournalTemplate,
  RecurringTemplateLine,
} from "../entities/RecurringJournalTemplate";

export interface RecurringCreateInput {
  tenantId: string;
  name: string;
  description?: string | null;
  frequency: RecurringJournalTemplate["frequency"];
  dayOfMonth: number;
  startDate: Date;
  endDate?: Date | null;
  templateLines: RecurringTemplateLine[];
}

export interface IRecurringRepository {
  create(input: RecurringCreateInput): Promise<RecurringJournalTemplate>;
  update(
    id: string,
    input: Partial<RecurringCreateInput> & { isActive?: boolean },
  ): Promise<RecurringJournalTemplate>;
  findById(id: string): Promise<RecurringJournalTemplate | null>;
  list(tenantId: string): Promise<RecurringJournalTemplate[]>;
  findDueToday(today: Date): Promise<RecurringJournalTemplate[]>;
  markGenerated(id: string, at: Date): Promise<void>;
  delete(id: string): Promise<void>;
}
