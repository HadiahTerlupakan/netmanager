export interface MobileErrorReportLogInput {
  action: string;
  subject: string;
  details: string;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IMobileErrorReportRepository {
  createSystemLog(input: MobileErrorReportLogInput): Promise<void>;
}
