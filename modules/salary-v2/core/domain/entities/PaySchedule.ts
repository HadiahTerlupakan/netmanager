import type { PayFrequency } from "../enums";

export interface PaySchedule {
  id: string;
  tenantId: string;
  name: string;
  frequency: PayFrequency;
  cutOffDay: number | null;
  cutOffDayOfWeek: number | null;
  payDay: number;
  payDayOffset: number | null;
  gracePeriodDays: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
