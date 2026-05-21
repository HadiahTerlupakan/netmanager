export interface RegionalMinimumWage {
  id: string;
  tenantId: string;
  regionCode: string;
  regionName: string;
  year: number;
  monthlyAmount: number;
  dailyAmount: number | null;
  effectiveDate: Date;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}
