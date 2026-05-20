import type { DebitCredit } from "./ChartOfAccount";

export type RecurringFreq = "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringTemplateLine {
  coaId: string;
  side: DebitCredit;
  amount: string;
  description: string | null;
}

export interface RecurringJournalTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  frequency: RecurringFreq;
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
  templateLines: RecurringTemplateLine[];
  isActive: boolean;
  lastGeneratedAt: Date | null;
}
