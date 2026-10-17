import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezoneSync: () => "Asia/Jakarta",
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));

import { AdminAttendanceBackdateRouteService } from "@/modules/attendance/services/AdminAttendanceBackdateRouteService";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance/services/AdminLeaveBalanceRouteService";
import { MobileLeaveRequestService } from "@/modules/attendance/services/MobileLeaveRequestService";
import { TenantSettingsService } from "@/modules/attendance/services/TenantSettingsService";

type Internals = Record<string, unknown>;

function lastActivity() {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  return logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas aksi admin & karyawan kehadiran", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat perubahan kuota cuti beserta nama karyawan dan tahun", async () => {
    const service = new AdminLeaveBalanceRouteService(
      {
        upsertQuota: vi.fn(),
        getUserBalances: vi.fn().mockResolvedValue([]),
      } as never,
      {
        findById: vi.fn().mockResolvedValue({ id: "user-1", name: "Budi" }),
      } as never,
    );
    vi.spyOn(
      service as unknown as { upsertQuotas: () => Promise<unknown> },
      "upsertQuotas",
    ).mockResolvedValue(undefined);

    await service.updateQuota({
      userId: "user-1",
      year: 2026,
      quotas: { CUTI: 14 },
      access: { requesterTenantId: "tenant-1", isSuperAdmin: false },
      actorId: "admin-1",
    });

    expect(lastActivity()).toEqual({
      action: "UPDATE",
      subject: "Kuota Cuti Budi 2026",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: {
        employeeId: "user-1",
        employeeName: "Budi",
        tahun: 2026,
        kuotaBaru: { CUTI: 14 },
      },
    });
  });

  it("mencatat perubahan pengaturan auto-reject izin", async () => {
    const service = new TenantSettingsService();
    (service as unknown as Internals).repository = {
      updateAutoRejectSettings: vi.fn().mockResolvedValue({}),
    };

    await service.updateAutoRejectSettings(
      "tenant-1",
      { enableTimelineAutoReject: false },
      "admin-1",
    );

    expect(lastActivity()).toEqual({
      action: "UPDATE",
      subject: "Pengaturan Absensi Auto-Reject Izin",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: { perubahan: { enableTimelineAutoReject: false } },
    });
  });

  it("mencatat backdate absensi beserta rentang dan jumlah data", async () => {
    const service = new AdminAttendanceBackdateRouteService(
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(
      service as unknown as { processOneDate: () => Promise<unknown> },
      "processOneDate",
    ).mockResolvedValue(2);

    await service.backfillAttendance({
      tenantId: "tenant-1",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      actorId: "admin-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "BACKDATE",
      subject: "Absensi 2026-10-01 s.d. 2026-10-02",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: { generatedCount: 4 },
    });
  });

  it("mencatat pengajuan izin dari mobile", async () => {
    const leaveRepository = {
      findRequesterContext: vi
        .fn()
        .mockResolvedValue({ name: "Budi", siteId: "s-1", workDays: null }),
      create: vi.fn().mockResolvedValue({ id: "leave-1" }),
    };
    const service = new MobileLeaveRequestService(
      leaveRepository as never,
      {} as never,
      {} as never,
    );
    const internals = service as unknown as Internals;
    vi.spyOn(
      internals as unknown as { calculateLeaveDays: () => Promise<unknown> },
      "calculateLeaveDays",
    ).mockResolvedValue(2);
    vi.spyOn(
      internals as unknown as { validateRequest: () => Promise<unknown> },
      "validateRequest",
    ).mockResolvedValue(null);
    vi.spyOn(
      internals as unknown as { uploadAttachments: () => Promise<unknown> },
      "uploadAttachments",
    ).mockResolvedValue(["/a.jpg"]);
    (internals.notificationHelper as Internals).notifyApprovers = vi.fn();

    const result = await service.createLeaveRequest({
      userId: "user-1",
      tenantId: "tenant-1",
      type: "SICK",
      startDate: "2026-10-17",
      endDate: "2026-10-18",
      reason: "demam",
      photos: ["data:image/jpeg;base64,xx"],
    } as never);

    expect(result).toEqual({ id: "leave-1" });
    expect(lastActivity()).toEqual({
      action: "CREATE",
      subject: "Izin 2026-10-17 s.d. 2026-10-18",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        leaveId: "leave-1",
        type: "SICK",
        jumlahHari: 2,
        reason: "demam",
        jumlahLampiran: 1,
      },
    });
  });
});

describe("Log Aktivitas hitung ulang evaluasi", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat recompute beserta rentang tanggal dan jumlah data", async () => {
    const { AttendanceService } =
      await import("@/modules/attendance/services/AttendanceService");
    const service = new AttendanceService();
    const internals = service as unknown as Internals;
    internals.timezoneService = {
      getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
    };
    internals.userRepo = { findAttendanceSettingsById: vi.fn() };
    vi.spyOn(
      internals as unknown as {
        findAttendancesForRecompute: () => Promise<unknown>;
      },
      "findAttendancesForRecompute",
    ).mockResolvedValue([]);
    vi.spyOn(
      internals as unknown as {
        collectHistoricalEvaluations: () => Promise<unknown>;
      },
      "collectHistoricalEvaluations",
    ).mockResolvedValue([{}, {}, {}]);

    await service.recomputeHistoricalAttendanceEvaluations({
      userId: "user-1",
      tenantId: "tenant-1",
      startDate: new Date("2026-09-30T17:00:00.000Z"),
      endDate: new Date("2026-10-31T16:59:59.999Z"),
      actorId: "admin-1",
    });

    expect(lastActivity()).toEqual({
      action: "RECOMPUTE",
      subject: "Absensi 2026-10-01 s.d. 2026-10-31",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: { employeeId: "user-1", processedCount: 3 },
    });
  });
});
