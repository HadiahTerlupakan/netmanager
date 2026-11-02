import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveScope: vi.fn(),
  attendanceReport: vi.fn(),
  overtimeReport: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (body: unknown) => ({ status: 200, body }),
  apiError: (message: string, _code: unknown, init: { status: number }) => ({
    status: init.status,
    body: { message },
  }),
  ErrorCodes: { VALIDATION_ERROR: "VALIDATION_ERROR" },
  ApiErrors: {
    forbidden: (message: string) => ({ status: 403, body: { message } }),
  },
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/modules/attendance", () => ({
  resolvePresenceReportScopeForUser: mocks.resolveScope,
  AttendanceService: class {
    getReportData = mocks.attendanceReport;
  },
}));
vi.mock("@/modules/overtime", () => ({
  OvertimeService: class {
    getReportData = mocks.overtimeReport;
  },
}));

import { GET } from "@/app/api/admin/reports/presence/route";

type Handler = (
  req: unknown,
  ctx: unknown,
) => Promise<{ status: number; body: unknown }>;
const handle = GET as unknown as Handler;

const USER = { id: "admin-1", tenantId: "tenant-1" };

function request(query: string) {
  const url = new URL(`http://localhost/api/admin/reports/presence?${query}`);
  return { nextUrl: url };
}

const CTX = { session: { user: USER }, permissions: [] as string[] };
const RANGE = "startDate=2026-10-01&endDate=2026-10-31";

/**
 * Regresi: route laporan kehadiran dulu memakai `dbUser.siteId` (site utama)
 * sebagai satu-satunya site admin ber-`site_only`.
 */
describe("GET /api/admin/reports/presence — lingkup multi-site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.attendanceReport.mockResolvedValue({ summary: {} });
    mocks.overtimeReport.mockResolvedValue({ summary: {} });
  });

  it("meneruskan seluruh site lingkup ke laporan kehadiran DAN lembur", async () => {
    const siteFilter = { in: ["site-a", "site-b"] };
    mocks.resolveScope.mockResolvedValue({
      siteId: siteFilter,
      departmentId: undefined,
      isEmpty: false,
    });

    const response = await handle(request(`${RANGE}&siteId=site-x`), CTX);

    expect(response.status).toBe(200);
    expect(mocks.resolveScope).toHaveBeenCalledWith(USER, {
      siteId: "site-x",
      departmentId: null,
    });
    expect(mocks.attendanceReport.mock.calls[0]?.[2]).toEqual(siteFilter);
    expect(mocks.overtimeReport.mock.calls[0]?.[2]).toEqual(siteFilter);
  });

  it("gagal tertutup: lingkup kosong tidak menjalankan query laporan", async () => {
    mocks.resolveScope.mockResolvedValue({ isEmpty: true });

    const response = await handle(request(RANGE), CTX);

    expect(response.body).toEqual({ attendance: [], overtime: [] });
    expect(mocks.attendanceReport).not.toHaveBeenCalled();
    expect(mocks.overtimeReport).not.toHaveBeenCalled();
  });

  it("menolak tanpa attendance:read maupun report:read", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = await handle(request(RANGE), CTX);

    expect(response.status).toBe(403);
    expect(mocks.resolveScope).not.toHaveBeenCalled();
  });
});
