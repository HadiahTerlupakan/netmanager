import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Regresi: popup pengumuman portal pelanggan memanggil /api/announcements yang
 * hanya menerima sesi staf, jadi pelanggan selalu 401 dan pengumuman diam-diam
 * tidak pernah tampil.
 */

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  getAnnouncements: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));
vi.mock("@/modules/notification", () => ({
  announcementService: { getAnnouncements: mockFns.getAnnouncements },
}));

import { GET } from "@/app/api/customer/announcements/route";

const request = () =>
  new NextRequest("http://localhost/api/customer/announcements");

describe("GET /api/customer/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menolak tanpa sesi pelanggan", async () => {
    mockFns.requireCustomerAuth.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockFns.getAnnouncements).not.toHaveBeenCalled();
  });

  it("mengembalikan pengumuman aktif untuk portal pelanggan", async () => {
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: "cust-1" },
    });
    mockFns.getAnnouncements.mockResolvedValue([{ id: "ann-1" }]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "ann-1" }]);
    expect(mockFns.getAnnouncements).toHaveBeenCalledWith({
      portal: "customer",
      activeOnly: true,
    });
  });
});
