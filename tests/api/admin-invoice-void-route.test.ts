import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Void berjalan di bawah kunci checkout pelanggan; kunci yang sedang dipegang
 * dijawab 409 dengan pesan untuk admin, bukan 500.
 */

const palsu = vi.hoisted(() => ({ voidInvoice: vi.fn() }));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  buildSessionWithPermissions: (session: unknown) => session,
  ApiErrors: {
    conflict: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 409 }),
  },
}));
vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: () => ({
    isRestricted: false,
    siteIds: [] as string[],
  }),
}));
vi.mock("@/modules/finance", () => ({
  VoidInvoiceService: { voidInvoice: palsu.voidInvoice },
}));

import { createRouteServiceError } from "@/lib/api/route-service-error";
import { POST } from "@/app/api/admin/invoices/[id]/void/route";

const CONTEXT = {
  params: { id: "inv-1" },
  validated: { reason: "Salah tagih" },
  permissions: ["finance:update:void"],
  session: { user: { id: "admin-1" } },
} as never;

const voidRequest = () =>
  new NextRequest("http://localhost/api/admin/invoices/inv-1/void", {
    method: "POST",
    body: JSON.stringify({ reason: "Salah tagih" }),
  });

describe("void tagihan oleh admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kunci checkout yang dipegang pelanggan dijawab 409 dengan pesannya", async () => {
    const message =
      "Pelanggan sedang memproses pembayaran untuk tagihan ini. Coba lagi beberapa saat lagi.";
    palsu.voidInvoice.mockRejectedValue(createRouteServiceError(message, 409));

    const response = await POST(voidRequest(), CONTEXT);

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 409,
      body: { success: false, error: message },
    });
  });

  // Galat berawalan (NOT_FOUND, FORBIDDEN, CONFLICT) dipetakan createHandler.
  it("galat lain tetap diserahkan ke createHandler", async () => {
    palsu.voidInvoice.mockRejectedValue(
      new Error("FORBIDDEN: Hanya invoice PAID atau PARTIAL_PAID"),
    );

    await expect(POST(voidRequest(), CONTEXT)).rejects.toThrow(
      "FORBIDDEN: Hanya invoice PAID atau PARTIAL_PAID",
    );
  });
});
