import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { ActiveAttendanceSessionService } from "./ActiveAttendanceSessionService";
import type { ReportedTrackingStatus } from "./tracking-gap";

/**
 * Menyimpan status tracking yang dilaporkan aplikasi (izin latar belakang
 * dicabut, GPS mati, ...) pada sesi kerja yang sedang berjalan. Tanpa laporan
 * ini, server hanya tahu tracking mati sesudah 45 menit tanpa titik.
 */
export class AttendanceTrackingStatusService {
  constructor(
    private readonly sessionService: ActiveAttendanceSessionService = new ActiveAttendanceSessionService(),
    private readonly attendanceRepo: AttendanceRepository = new AttendanceRepository(),
  ) {}

  async record(input: {
    userId: string;
    tenantId?: string;
    status: ReportedTrackingStatus;
  }): Promise<{ recorded: boolean }> {
    const attendanceId = await this.sessionService.findCurrentSessionId(
      input.userId,
      input.tenantId,
    );
    if (!attendanceId) return { recorded: false };

    await this.attendanceRepo.updateTrackingStatus({
      attendanceId,
      status: input.status,
      at: new Date(),
    });
    return { recorded: true };
  }
}
