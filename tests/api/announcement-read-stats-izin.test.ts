import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: mockFns.requireAuth,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
  ensurePermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
  },
}));

import { GET } from "@/app/api/announcements/[id]/read/route";

const PARAMS = { params: Promise.resolve({ id: "ann-1" }) };

function permintaan() {
  return new NextRequest("http://localhost/api/announcements/ann-1/read");
}

describe("GET /api/announcements/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("menolak pengguna login yang tidak punya izin announcement:read", async () => {
    mockFns.hasPermission.mockResolvedValue(false);

    const response = await GET(permintaan(), PARAMS);

    expect(response.status).toBe(403);
    expect(mockFns.hasPermission).toHaveBeenCalledWith("announcement:read");
    // Nama pembaca tidak boleh sempat diambil sama sekali.
    expect(prismaMock.announcementRead.findMany).not.toHaveBeenCalled();
  });

  it("mengembalikan statistik untuk pengguna yang berizin", async () => {
    mockFns.hasPermission.mockResolvedValue(true);
    prismaMock.announcement.findUnique.mockResolvedValue({
      id: "ann-1",
      title: "Judul",
      target: "ALL",
    } as never);
    prismaMock.announcementRead.count.mockResolvedValue(1 as never);
    prismaMock.announcementRead.findMany.mockResolvedValue([
      {
        announcementId: "ann-1",
        userId: "user-9",
        pelangganId: null,
        portal: "admin",
        tenantId: null,
        readAt: new Date("2026-10-11T10:00:00.000Z"),
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-9", name: "Budi" },
    ] as never);

    const response = await GET(permintaan(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.readCount).toBe(1);
    expect(body.recentReaders[0].readerName).toBe("Budi");
  });
});
