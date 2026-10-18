import { logger } from "@/lib/logger";
import { getTimezone } from "@/lib/utils/get-timezone";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import {
  AttendanceSessionPolicyService,
  type AttendanceSessionPolicyInput,
} from "./AttendanceSessionPolicyService";
import {
  LOCATION_CLOCK_SKEW_MS,
  type LocationSessionWindow,
} from "./location-session-window";

/**
 * Sesi terbuka tertua yang masih mungkin aktif. Sesi fleksibel bertahan 24 jam
 * dan shift malam berakhir esok harinya, jadi "check-in hari ini" tidak cukup.
 */
const OPEN_SESSION_LOOKBACK_MS = 36 * 60 * 60 * 1000;

type PolicyAttendance = AttendanceSessionPolicyInput["attendance"];

type LiveMapSessionRow = Awaited<
  ReturnType<AttendanceRepository["findOpenSessionsForLiveMap"]>
>[number];

/**
 * Menjawab "siapa yang sedang bekerja" dengan aturan yang sama dengan status
 * absen di aplikasi mobile, untuk live map dan penerimaan lokasi.
 */
export class ActiveAttendanceSessionService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository = new AttendanceRepository(),
    private readonly policy: AttendanceSessionPolicyService = new AttendanceSessionPolicyService(),
  ) {}

  /** Sesi aktif terbaru per karyawan, untuk live map. */
  async findActiveSessions(input: {
    timezoneTenantId?: string;
    tenantId?: string;
    userFilter?: { siteId?: string; departmentId?: string };
  }): Promise<LiveMapSessionRow[]> {
    const now = new Date();
    const timezone = await getTimezone(input.timezoneTenantId);
    const sessions = await this.attendanceRepo.findOpenSessionsForLiveMap({
      since: new Date(now.getTime() - OPEN_SESSION_LOOKBACK_MS),
      tenantId: input.tenantId,
      userFilter: input.userFilter,
    });

    return latestSessionPerUser(sessions).filter((session) =>
      this.isActive(session as PolicyAttendance, now, timezone),
    );
  }

  /** Apakah user sedang dalam sesi kerja yang masih berjalan. */
  async isUserInActiveSession(
    userId: string,
    tenantId?: string,
  ): Promise<boolean> {
    return (await this.findCurrentSessionId(userId, tenantId)) !== null;
  }

  /** Id sesi kerja user yang masih berjalan, atau null. */
  async findCurrentSessionId(
    userId: string,
    tenantId?: string,
  ): Promise<string | null> {
    const attendance = await this.attendanceRepo.findFirstForCurrentStatus({
      userId,
      tenantId,
    });
    if (!attendance) return null;
    const timezone = await getTimezone(tenantId);
    const isActive = this.isActive(
      attendance as PolicyAttendance,
      new Date(),
      timezone,
    );
    return isActive ? attendance.id : null;
  }

  /**
   * Rentang sesi kerja user yang beririsan dengan `from`..`to`. Sesi terbuka
   * yang masih berjalan berakhir "sekarang"; sesi terbuka yang sudah lewat
   * batasnya tidak dihitung karena tracking seharusnya sudah berhenti.
   */
  async findSessionWindows(input: {
    userId: string;
    from: Date;
    to: Date;
    tenantId?: string;
  }): Promise<LocationSessionWindow[]> {
    const now = new Date();
    // Diperlebar sebesar toleransi jam HP: titik 5 menit sebelum check-in yang
    // dikirim sendirian tidak akan pernah sampai ke `isWithinSessionWindows`
    // bila sesinya sudah tersaring di sini.
    const [sessions, timezone] = await Promise.all([
      this.attendanceRepo.findSessionsOverlapping({
        ...input,
        from: new Date(input.from.getTime() - LOCATION_CLOCK_SKEW_MS),
        to: new Date(input.to.getTime() + LOCATION_CLOCK_SKEW_MS),
      }),
      getTimezone(input.tenantId),
    ]);

    return sessions.flatMap((session) => {
      if (session.checkOut) {
        return [{ start: session.checkIn, end: session.checkOut }];
      }
      const isActive = this.isActive(
        session as PolicyAttendance,
        now,
        timezone,
      );
      return isActive ? [{ start: session.checkIn, end: now }] : [];
    });
  }

  /**
   * Jam shift yang tidak berformat HH:mm membuat policy melempar galat. Di sini
   * satu karyawan seperti itu akan menggagalkan live map seluruh tenant, jadi
   * sesinya dinilai dengan jam kerja bawaan seolah tanpa shift.
   */
  private isActive(
    attendance: PolicyAttendance,
    now: Date,
    timezone: string,
  ): boolean {
    const input: AttendanceSessionPolicyInput = {
      attendance,
      now,
      scheduleEndTime: null,
      timezone,
    };
    try {
      return this.policy.isSessionActive(input);
    } catch (error) {
      logger.warn("[LiveLocation] Jam shift tidak valid, memakai jam bawaan", {
        attendanceId: attendance.id,
        error,
      });
      const tanpaShift: PolicyAttendance["user"] = attendance.user
        ? { ...attendance.user, shift: null }
        : null;
      return this.policy.isSessionActive({
        ...input,
        attendance: { ...attendance, user: tanpaShift },
      });
    }
  }
}

/** Sesi diurutkan check-in terbaru dulu; ambil yang pertama per user. */
function latestSessionPerUser(
  sessions: LiveMapSessionRow[],
): LiveMapSessionRow[] {
  const latest = new Map<string, LiveMapSessionRow>();
  for (const session of sessions) {
    if (!latest.has(session.userId)) latest.set(session.userId, session);
  }
  return [...latest.values()];
}
