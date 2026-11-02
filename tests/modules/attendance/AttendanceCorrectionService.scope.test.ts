import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  findActor: vi.fn(),
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/modules/users", () => ({
  UserLookupService: class {
    findById = mocks.findActor;
  },
}));

import { AttendanceCorrectionService } from "@/modules/attendance/services/AttendanceCorrectionService";

const SOURCE = {
  id: "att-1",
  tenantId: "t1",
  status: "ABSENT",
  correctedAt: null as Date | null,
  userId: "emp-1",
  checkIn: new Date("2026-04-17T00:00:00.000Z"),
  user: {
    siteId: "site-b",
    departmentId: "dep-b",
    joinDate: null as Date | null,
  },
};

function correct(service: AttendanceCorrectionService) {
  return service.correctMissedCheckIn({
    sourceAttendanceId: "att-1",
    tenantId: "t1",
    actorId: "admin-1",
    actor: { id: "admin-1", role: "ADMIN" },
    checkIn: new Date("2026-04-17T01:00:00.000Z"),
    checkOut: null,
    reason: "lupa absen",
    notes: null,
    evidencePhotoUrl: "/x.webp",
  });
}

// Regresi: koreksi mangkir hanya memeriksa tenant, sehingga admin
// ber-attendance:site_only bisa mengoreksi absensi site lain.
describe("AttendanceCorrectionService — lingkup admin", () => {
  const repository = {
    findCorrectionSourceById: vi.fn(),
    createCorrectedAttendance: vi.fn(),
    markAttendanceAsCorrected: vi.fn(),
    findLatestEvaluationForUser: vi.fn(),
    recordEvaluationChange: vi.fn(),
    applyMissedCheckInCorrection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findCorrectionSourceById.mockResolvedValue(SOURCE);
  });

  it.each([
    [
      "site lain",
      ["attendance:site_only"],
      { siteId: "site-a", departmentId: "dep-b" },
    ],
    [
      "tanpa site",
      ["attendance:site_only"],
      { siteId: null, departmentId: null },
    ],
    [
      "departemen lain",
      ["attendance:department_only"],
      { siteId: "site-b", departmentId: "dep-a" },
    ],
  ])("admin terbatas %s ditolak 404", async (_label, permissions, actor) => {
    mocks.getUserPermissions.mockResolvedValue(permissions);
    mocks.findActor.mockResolvedValue(actor);

    await expect(
      correct(new AttendanceCorrectionService(repository as never)),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.applyMissedCheckInCorrection).not.toHaveBeenCalled();
    expect(repository.createCorrectedAttendance).not.toHaveBeenCalled();
  });
});
