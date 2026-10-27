import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `POST /api/pelanggan-ppp/[id]/renew` sempat 404 sejak model tagihan lama
 * dihapus. Route ini mencatat pembayaran, jadi menuntut `pelanggan:update`
 * DAN `payments:create` (`permissionsAll`), dan body-nya divalidasi Zod
 * sebelum service dipanggil.
 */

const palsu = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  renew: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: palsu.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: palsu.getUserPermissions,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/pelanggan", async () => {
  const { renewPelangganSchema } =
    await import("@/modules/pelanggan/validators/pelanggan-renewal");
  class PelangganAdminMutationError extends Error {
    constructor(
      message: string,
      readonly code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND",
    ) {
      super(message);
    }
  }
  return {
    renewPelangganSchema,
    PelangganAdminMutationError,
    PelangganRenewalService: class {
      renew = palsu.renew;
    },
  };
});

vi.mock("@/modules/finance", () => ({
  CustomerRenewalError: class CustomerRenewalError extends Error {
    constructor(
      message: string,
      readonly code: "NOT_FOUND" | "NOT_RENEWABLE",
    ) {
      super(message);
    }
  },
}));

import { POST } from "@/app/api/pelanggan-ppp/[id]/renew/route";
import { CustomerRenewalError } from "@/modules/finance";
import { PelangganAdminMutationError } from "@/modules/pelanggan";

const KONTEKS_ROUTE = { params: Promise.resolve({ id: "pel-1" }) };
const IZIN_LENGKAP = ["pelanggan:update", "payments:create"];
const BODY_SAH = { statusBayar: "LUNAS", paymentMethod: "BANK_TRANSFER" };

function buatRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/pelanggan-ppp/pel-1/renew", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sesiDenganIzin(permissions: string[]): void {
  palsu.getServerSession.mockResolvedValue({
    user: {
      id: "admin-1",
      email: "admin@example.com",
      tenantId: "tenant-1",
      isSuperAdmin: false,
      permissions,
    },
  });
}

describe("POST /api/pelanggan-ppp/[id]/renew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.renew.mockResolvedValue({
      invoiceId: "inv-1",
      invoiceStatus: "PAID",
      expectedJatuhTempo: new Date("2026-12-05T00:00:00.000Z"),
    });
  });

  it("meneruskan body tervalidasi ke service dan mengembalikan hasilnya", async () => {
    sesiDenganIzin(IZIN_LENGKAP);

    const response = await POST(
      buatRequest({ ...BODY_SAH, reference: "TRX-1" }),
      KONTEKS_ROUTE,
    );

    expect(response.status).toBe(200);
    expect(palsu.renew).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pel-1",
        userId: "admin-1",
        data: { ...BODY_SAH, reference: "TRX-1" },
      }),
    );
    const badan = await response.json();
    expect(badan.data).toEqual({
      invoiceId: "inv-1",
      invoiceStatus: "PAID",
      expectedJatuhTempo: "2026-12-05T00:00:00.000Z",
    });
  });

  it("menolak 403 tanpa payments:create", async () => {
    sesiDenganIzin(["pelanggan:update"]);

    const response = await POST(buatRequest(BODY_SAH), KONTEKS_ROUTE);

    expect(response.status).toBe(403);
    expect(palsu.renew).not.toHaveBeenCalled();
  });

  it.each([
    ["metode lama di luar enum", { ...BODY_SAH, paymentMethod: "TRANSFER" }],
    ["statusBayar hilang", { paymentMethod: "CASH" }],
  ])("menolak 400 untuk %s", async (_kasus, body) => {
    sesiDenganIzin(IZIN_LENGKAP);

    const response = await POST(buatRequest(body), KONTEKS_ROUTE);

    expect(response.status).toBe(400);
    expect(palsu.renew).not.toHaveBeenCalled();
  });

  it("memetakan pelanggan di luar tenant ke 404", async () => {
    sesiDenganIzin(IZIN_LENGKAP);
    palsu.renew.mockRejectedValue(
      new PelangganAdminMutationError("Pelanggan tidak ditemukan", "NOT_FOUND"),
    );

    const response = await POST(buatRequest(BODY_SAH), KONTEKS_ROUTE);

    expect(response.status).toBe(404);
  });

  it("memetakan pelanggan yang tidak bisa diperpanjang ke 400", async () => {
    sesiDenganIzin(IZIN_LENGKAP);
    palsu.renew.mockRejectedValue(
      new CustomerRenewalError("Pelanggan sudah dismantle", "NOT_RENEWABLE"),
    );

    const response = await POST(buatRequest(BODY_SAH), KONTEKS_ROUTE);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Pelanggan sudah dismantle");
  });
});
