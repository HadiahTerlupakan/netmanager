import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/api-response", () => ({
  ApiErrors: {
    forbidden: (message: string) =>
      NextResponse.json({ error: message }, { status: 403 }),
  },
  apiError: (message: string, _code?: string, options?: { status?: number }) =>
    NextResponse.json({ error: message }, { status: options?.status ?? 500 }),
  ErrorCodes: {
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

import { GET } from "@/app/api/mobile/partners/route";

describe("mobile partners route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      permissions: ["m_partners:read"],
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
      new NextRequest(
        "http://localhost/api/mobile/partners?search=partner&page=1&limit=20",
      ),
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
