import { NextRequest } from "next/server";
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

import { GET } from "@/app/api/mobile/announcements/route";

describe("GET /api/mobile/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      userId: "user-1",
      sub: "user-1",
      role: "EMPLOYEE",
      tenantId: "tenant-1",
    });
  });

  it("returns active employee announcements as a raw array", async () => {
    prismaMock.announcement.findMany.mockResolvedValueOnce([
      {
        id: "ann-1",
        title: "Pengumuman 1",
        content: "Konten 1",
        isPinned: true,
        createdAt: new Date("2026-04-16T00:00:00.000Z"),
      },
      {
        id: "ann-2",
        title: "Pengumuman 2",
        content: "Konten 2",
        isPinned: false,
        createdAt: new Date("2026-04-15T00:00:00.000Z"),
      },
    ] as never);

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/announcements?active=true"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json).toEqual([
      {
        id: "ann-1",
        title: "Pengumuman 1",
        content: "Konten 1",
        isPinned: true,
        createdAt: "2026-04-16T00:00:00.000Z",
      },
      {
        id: "ann-2",
        title: "Pengumuman 2",
        content: "Konten 2",
        isPinned: false,
        createdAt: "2026-04-15T00:00:00.000Z",
      },
    ]);
    expect(prismaMock.announcement.findMany).toHaveBeenCalledWith({
      where: {
        target: { in: ["ALL", "EMPLOYEE"] },
        isActive: true,
        startDate: { lte: expect.any(Date) },
        OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
        tenantId: "tenant-1",
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        isPinned: true,
        createdAt: true,
      },
    });
  });

  it("respects explicit customer portal targeting", async () => {
    prismaMock.announcement.findMany.mockResolvedValueOnce([] as never);

    await GET(
      new NextRequest(
        "http://localhost/api/mobile/announcements?portal=customer",
      ),
    );

    expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          target: { in: ["ALL", "CUSTOMER"] },
        }),
      }),
    );
  });
});
