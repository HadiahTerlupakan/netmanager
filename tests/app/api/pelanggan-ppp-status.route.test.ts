import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  updateCustomerStatus: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: async () => ({ user: { id: "admin-1", name: "Admin" } }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { logActivity: vi.fn(), error: vi.fn() },
}));
vi.mock("@/modules/pelanggan", () => ({
  PelangganPppRouteService: class {
    updateCustomerStatus = mockFns.updateCustomerStatus;
  },
  RouteServiceError: class extends Error {},
}));

describe("PATCH /api/pelanggan-ppp/[id]/status", () => {
  let PATCH: (typeof import("@/app/api/pelanggan-ppp/[id]/status/route"))["PATCH"];

  beforeAll(async () => {
    ({ PATCH } = await import("@/app/api/pelanggan-ppp/[id]/status/route"));
  });

  it("berhasil tanpa membocorkan password walau baris memuat BigInt", async () => {
    mockFns.updateCustomerStatus.mockResolvedValue({
      pelanggan: { id: "p1", nama: "TES", status: "AKTIF" },
      updatedPelanggan: {
        id: "p1",
        status: "ISOLIR",
        password: "rahasia",
        saldoKreditRupiah: 0n,
      },
      message: "Status updated to ISOLIR",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/pelanggan-ppp/p1/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "ISOLIR" }),
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true });
    expect(body.data).toEqual({ id: "p1", status: "ISOLIR" });
  });
});
