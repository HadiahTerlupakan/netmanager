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

  it("berhasil walau baris pelanggan memuat saldoKreditRupiah bertipe BigInt", async () => {
    mockFns.updateCustomerStatus.mockResolvedValue({
      pelanggan: { id: "p1", nama: "TES", status: "AKTIF" },
      updatedPelanggan: { id: "p1", status: "ISOLIR", saldoKreditRupiah: 0n },
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
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: "p1", status: "ISOLIR", saldoKreditRupiah: 0 },
    });
  });
});
