import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.hoisted(() => vi.fn());
const mockGetRingkasan = vi.hoisted(() => vi.fn());
const mockGetProjectDetail = vi.hoisted(() => vi.fn());
const mockGetPayouts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mobile-investor-auth", () => ({
  requireInvestorMobileSession: mockRequireSession,
}));
vi.mock("@/modules/investor", () => ({
  getInvestorPortalKeuanganService: () => ({ getRingkasan: mockGetRingkasan }),
  getInvestorPortalProjectService: () => ({ getProjectDetail: mockGetProjectDetail }),
  getInvestorPortalPayoutService: () => ({ getPayouts: mockGetPayouts }),
}));

import { createRouteServiceError } from "@/lib/api/route-service-error";
import { GET as getDashboard } from "@/app/api/mobile/investor/dashboard/route";
import { GET as getPayouts } from "@/app/api/mobile/investor/payouts/route";
import { GET as getProjectDetail } from "@/app/api/mobile/investor/projects/[id]/route";

const SESI = { id: "inv-1", username: "pakbudi", namaLengkap: "Budi", tenantId: "tenant-1" };

function request(path: string) {
  return new Request(`http://localhost/api/mobile/investor/${path}`, {
    headers: { authorization: "Bearer token" },
  });
}

describe("/api/mobile/investor/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue(SESI);
  });

  it("tanpa token investor sah → 401 dan service tidak dipanggil", async () => {
    mockRequireSession.mockResolvedValue(
      NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 }),
    );

    const response = await getDashboard(request("dashboard"));

    expect(response.status).toBe(401);
    expect(mockGetRingkasan).not.toHaveBeenCalled();
  });

  it("dashboard memakai investor & tenant dari sesi, bukan dari request", async () => {
    mockGetRingkasan.mockResolvedValue({ activeProjectsCount: 2 });

    const response = await getDashboard(request("dashboard?investorId=lain"));

    expect(response.status).toBe(200);
    expect(mockGetRingkasan).toHaveBeenCalledWith("inv-1", "tenant-1");
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { activeProjectsCount: 2 },
    });
  });

  it("proyek bukan milik investor → 404 dari service diteruskan", async () => {
    mockGetProjectDetail.mockRejectedValue(
      createRouteServiceError("Proyek tidak ditemukan", 404),
    );

    const response = await getProjectDetail(request("projects/p-9"), {
      params: Promise.resolve({ id: "p-9" }),
    });

    expect(response.status).toBe(404);
    expect(mockGetProjectDetail).toHaveBeenCalledWith("p-9", "inv-1", "tenant-1");
  });

  it("galat tak terduga → 500 tanpa detail internal", async () => {
    mockGetPayouts.mockRejectedValue(new Error("koneksi DB putus di 10.0.0.5"));

    const response = await getPayouts(request("payouts?page=2"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
    expect(mockGetPayouts.mock.calls[0][1].get("page")).toBe("2");
  });
});
