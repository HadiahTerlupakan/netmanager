export interface HolidayEntity {
  id?: string;
  tenantId?: string | null;
  date: Date;
  description: string | null;
  isNational?: boolean | null;
}
