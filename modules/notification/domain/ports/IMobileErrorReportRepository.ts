/**
 * Input untuk menyimpan laporan error mobile ke SystemLog.
 *
 * `userId` nullable karena mitra & pelanggan tidak ada di tabel `User`
 * (di DB utama) — aktor non-user direpresentasikan via `actorType` + `actorId`
 * untuk menghindari FK violation `SystemLog_userId_fkey`.
 */
export interface MobileErrorReportLogInput {
  action: string;
  subject: string;
  details: string;
  userId: string | null;
  actorType: string | null;
  actorId: string | null;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IMobileErrorReportRepository {
  createSystemLog(input: MobileErrorReportLogInput): Promise<void>;
}
