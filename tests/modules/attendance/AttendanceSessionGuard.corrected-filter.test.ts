import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceSessionGuardService } from "@/modules/attendance/services/AttendanceSessionGuardService";
import type { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";

const mockAttendanceRepo = {
  findManyStaleSessions: vi.fn(),
  findFirstOpenSession: vi.fn(),
  update: vi.fn(),
} as unknown as AttendanceRepository;

describe("AttendanceSessionGuardService - corrected attendance filter", () => {
  let service: AttendanceSessionGuardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AttendanceSessionGuardService(mockAttendanceRepo);
  });

  it("harus mengizinkan check-in baru ketika hanya ada attendance terkoreksi", async () => {
    // Setup: findFirstOpenSession tidak menemukan open session
    // karena row ABSENT/ALPHA yang sudah correctedAt != null diabaikan
    vi.mocked(mockAttendanceRepo.findFirstOpenSession).mockResolvedValue(null);

    // Ekspektasi: tidak throw error
    await expect(
      service.assertNoActiveSessionConflict({
        userId: "user-1",
        userDetails: null,
        checkInTime: new Date("2026-05-08T01:00:00Z"),
        timezone: "Asia/Jakarta",
        tenantId: "tenant-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("harus tetap menolak check-in jika ada open session aktif yang belum dikoreksi", async () => {
    // Setup: Ada attendance aktif yang belum checkout dan belum dikoreksi
    const activeAttendance: {
      id: string;
      userId: string;
      checkIn: Date;
      checkOut: Date | null;
      correctedAt: Date | null;
      status: string;
      tenantId: string;
      user: {
        workingHourMode: "FIXED";
        flexibleTargetHour: number | null;
        shift: {
          startTime: string;
          endTime: string;
        } | null;
      };
    } = {
      id: "attendance-active-1",
      userId: "user-1",
      checkIn: new Date("2026-05-08T00:30:00Z"),
      checkOut: null,
      correctedAt: null,
      status: "PRESENT",
      tenantId: "tenant-1",
      user: {
        workingHourMode: "FIXED",
        flexibleTargetHour: null,
        shift: {
          startTime: "08:00",
          endTime: "17:00",
        },
      },
    };

    vi.mocked(mockAttendanceRepo.findFirstOpenSession).mockResolvedValue(
      activeAttendance as never,
    );

    // Ekspektasi: throw DUPLICATE_ENTRY karena masih ada sesi aktif
    await expect(
      service.assertNoActiveSessionConflict({
        userId: "user-1",
        userDetails: null,
        checkInTime: new Date("2026-05-08T01:00:00Z"),
        timezone: "Asia/Jakarta",
        tenantId: "tenant-1",
      }),
    ).rejects.toThrow("DUPLICATE_ENTRY");
  });
});
