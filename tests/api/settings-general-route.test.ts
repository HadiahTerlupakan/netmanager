import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetGeneralSettings = vi.fn();
const mockUpdateGeneralSettings = vi.fn();
const mockLogActivitySafe = vi.fn();
const mockInvalidateTimezoneCache = vi.fn();
const mockAttendanceInvalidateCache = vi.fn();

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (req: Request, ctx: unknown) => unknown,
  ) => handler,
  apiSuccess: <T>(data: T) => data,
}));

vi.mock("@/modules/settings", () => ({
  getGeneralSettings: (...args: unknown[]) => mockGetGeneralSettings(...args),
  updateGeneralSettings: (...args: unknown[]) =>
    mockUpdateGeneralSettings(...args),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: (...args: unknown[]) => mockLogActivitySafe(...args),
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  invalidateTimezoneCache: (...args: unknown[]) =>
    mockInvalidateTimezoneCache(...args),
}));

vi.mock("@/modules/attendance", () => ({
  AttendanceTimezoneService: class MockAttendanceTimezoneService {
    invalidateCache = (...args: unknown[]) =>
      mockAttendanceInvalidateCache(...args);
  },
}));

import { POST } from "@/app/api/settings/general/route";

describe("general settings route cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still returns success when attendance timezone cache invalidation fails", async () => {
    mockUpdateGeneralSettings.mockResolvedValue(undefined);
    mockAttendanceInvalidateCache.mockRejectedValueOnce(
      new Error("redis down"),
    );

    const result = await POST(
      new NextRequest("http://localhost/api/settings/general", {
        method: "POST",
      }),
      {
        session: {
          user: {
            id: "user-1",
          },
        },
        validated: {
          perusahaan: "PT Radpro",
          namaAplikasi: "NetManager",
          alamat: "Jl. Test",
          nomorHp: "08123",
          deskripsiInvoice: "Invoice",
          rekeningBank: [],
          invoiceOtomatis: "5",
          disablePerpanjanganPaket: "5",
          timezone: "Asia/Jakarta",
          attendanceTolerance: "0",
          reminderOtomatis: "3",
          reminderFrequency: "DAILY",
          reminderTime: "08:00",
          notifApp: true,
          notifWa: false,
          notifEmail: false,
        },
      } as never,
    );

    expect(mockUpdateGeneralSettings).toHaveBeenCalledTimes(1);
    expect(mockInvalidateTimezoneCache).toHaveBeenCalledTimes(1);
    expect(mockAttendanceInvalidateCache).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
