import { NextRequest, NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  getUserPermissions: vi.fn().mockResolvedValue([]),
  isSuperAdmin: vi.fn().mockReturnValue(true),
  logActivitySafe: vi.fn(),
  convertAndSaveImage: vi.fn(),
  validateUploadFile: vi.fn(),
  correctMissedCheckIn: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (
      data: unknown,
      options?: { status?: number; message?: string },
    ) =>
      NextResponse.json(
        {
          success: true,
          data,
          ...(options?.message ? { message: options.message } : {}),
        },
        { status: options?.status ?? 200 },
      ),
  };
});

vi.mock("@/lib/api-response", () => ({
  ApiErrors: {
    badRequest: (error: string) =>
      NextResponse.json({ error }, { status: 400 }),
    forbidden: (error: string) => NextResponse.json({ error }, { status: 403 }),
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mockFns.logActivitySafe,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: mockFns.convertAndSaveImage,
}));

vi.mock("@/lib/upload/upload-policy", () => ({
  validateUploadFile: mockFns.validateUploadFile,
}));

vi.mock("@/modules/attendance/services/AttendanceCorrectionService", () => ({
  AttendanceCorrectionService: class MockAttendanceCorrectionService {
    correctMissedCheckIn = mockFns.correctMissedCheckIn;
  },
}));

import { POST as postRoute } from "@/app/api/admin/attendance/[id]/correct-missed-checkin/route";

type PostRouteContext = Parameters<typeof postRoute>[1];

const createRouteContext = (attendanceId: string): PostRouteContext =>
  ({
    params: { id: attendanceId },
    session: { user: { id: "admin-1", tenantId: "tenant-1" } },
  }) as unknown as PostRouteContext;

describe("admin attendance correct missed check-in route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.validateUploadFile.mockReturnValue({
      ok: true,
      safeBaseName: "proof",
      extension: "png",
    });
    mockFns.convertAndSaveImage.mockResolvedValue(
      "/uploads/employee/attendance/admin-1-proof.webp",
    );
  });

  it("returns 403 when user lacks attendance:correct-missed-checkin", async () => {
    mockFns.hasPermission.mockResolvedValue(false);

    const body = new FormData();
    body.set("checkIn", "2026-04-17T08:03");
    body.set("reason", "Karyawan hadir");
    body.set("photo", new File(["img"], "proof.png", { type: "image/png" }));

    const response = await postRoute(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-absent-1/correct-missed-checkin",
        {
          method: "POST",
          body,
        },
      ),
      createRouteContext("attendance-absent-1"),
    );

    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses ditolak");
    expect(mockFns.correctMissedCheckIn).not.toHaveBeenCalled();
  });

  it("returns 400 when photo is missing", async () => {
    const body = new FormData();
    body.set("checkIn", "2026-04-17T08:03");
    body.set("reason", "Karyawan hadir");

    const response = await postRoute(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-absent-1/correct-missed-checkin",
        {
          method: "POST",
          body,
        },
      ),
      createRouteContext("attendance-absent-1"),
    );

    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Foto bukti wajib diupload");
    expect(mockFns.validateUploadFile).not.toHaveBeenCalled();
    expect(mockFns.correctMissedCheckIn).not.toHaveBeenCalled();
  });

  it("uploads evidence photo and delegates correction to service", async () => {
    mockFns.correctMissedCheckIn.mockResolvedValue({
      sourceAttendanceId: "attendance-absent-1",
      correctedAttendance: { id: "attendance-corrected-1", status: "ON_TIME" },
    });

    const proofFile = new File(["img"], "proof.png", { type: "image/png" });
    const body = new FormData();
    body.set("checkIn", "2026-04-17T08:03");
    body.set("checkOut", "");
    body.set("reason", "Karyawan hadir tetapi lupa check-in");
    body.set("notes", "Diverifikasi oleh admin HR");
    body.set("photo", proofFile);

    const response = await postRoute(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-absent-1/correct-missed-checkin",
        {
          method: "POST",
          body,
        },
      ),
      createRouteContext("attendance-absent-1"),
    );

    const json = await response.json();

    expect(mockFns.validateUploadFile).toHaveBeenCalledWith({
      folder: "uploads",
      mimeType: "image/png",
      size: proofFile.size,
      fileName: "proof.png",
    });
    expect(mockFns.convertAndSaveImage).toHaveBeenCalledWith(
      expect.any(File),
      "public/uploads/employee/attendance",
      expect.any(String),
      "employee-attendance",
      "admin-1",
    );
    expect(mockFns.correctMissedCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAttendanceId: "attendance-absent-1",
        tenantId: "tenant-1",
        actorId: "admin-1",
        reason: "Karyawan hadir tetapi lupa check-in",
        notes: "Diverifikasi oleh admin HR",
        checkOut: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    );

    const [serviceInput] = mockFns.correctMissedCheckIn.mock.calls[0] as [
      { checkIn: Date; checkOut: Date | null },
    ];
    expect(serviceInput.checkIn).toBeInstanceOf(Date);
    expect(serviceInput.checkIn.toISOString()).toBe(
      fromZonedTime("2026-04-17T08:03:00", "Asia/Jakarta").toISOString(),
    );
    expect(serviceInput.checkOut).toBeNull();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toBe("Koreksi missed check-in berhasil disimpan");
  });
});
