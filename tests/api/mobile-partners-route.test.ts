import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const { mockVerifyMobileToken } = vi.hoisted(() => ({
  mockVerifyMobileToken: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: vi.fn().mockResolvedValue(null),
  verifyMobileToken: (...args: unknown[]) => mockVerifyMobileToken(...args),
}));

vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logAuditActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

import { GET } from "@/app/api/mobile/partners/route";

const authedRequest = (url: string) =>
  new NextRequest(url, { headers: { Authorization: "Bearer valid-token" } });

const routeCtx = { params: Promise.resolve({}) };

describe("mobile partners route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: null,
      permissions: ["m_partners:read"],
      isSuperAdmin: false,
    });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.overtime.findFirst.mockResolvedValue(null);
  });

  it("menyembunyikan partner yang sedang libur hari ini dan tidak sedang lembur aktif", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "partner-libur",
        name: "Partner Libur",
        role: { name: "Partner" },
        sites: { name: "Site A" },
      },
      {
        id: "partner-lembur",
        name: "Partner Lembur",
        role: { name: "Partner" },
        sites: { name: "Site B" },
      },
      {
        id: "partner-normal",
        name: "Partner Normal",
        role: { name: "Partner" },
        sites: { name: "Site C" },
      },
    ] as never);
    prismaMock.user.count.mockResolvedValue(3);

    prismaMock.leaveRequest.findFirst
      .mockResolvedValueOnce({ type: "CUTI", reason: "Cuti tahunan" } as never)
      .mockResolvedValueOnce({ type: "CUTI", reason: "Cuti tahunan" } as never)
      .mockResolvedValueOnce(null);

    prismaMock.overtime.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ot-1", status: "IN_PROGRESS" } as never);

    const response = await GET(
      authedRequest(
        "http://localhost/api/mobile/partners?search=partner&page=1&limit=20",
      ),
      routeCtx,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toEqual([
      {
        id: "partner-lembur",
        name: "Partner Lembur",
        role: { name: "Partner" },
        sites: { name: "Site B" },
      },
      {
        id: "partner-normal",
        name: "Partner Normal",
        role: { name: "Partner" },
        sites: { name: "Site C" },
      },
    ]);
  });
});
