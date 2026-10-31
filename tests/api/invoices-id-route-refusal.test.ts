import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pembatalan lewat ubah tagihan dan penghapusan tagihan yang sedang dibayar
 * ditolak layanan dengan galat 409; admin harus menerima pesannya, bukan
 * "Terjadi kesalahan pada server".
 */

const palsu = vi.hoisted(() => ({
  updateInvoiceForRoute: vi.fn(),
  deleteInvoiceForRoute: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  ApiErrors: {
    notFound: (resource: string) =>
      NextResponse.json(
        { success: false, error: `${resource} tidak ditemukan` },
        { status: 404 },
      ),
    forbidden: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 403 }),
    conflict: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 409 }),
  },
}));
vi.mock("@/modules/finance", () => ({
  getInvoiceForRoute: vi.fn(),
  updateInvoiceForRoute: palsu.updateInvoiceForRoute,
  deleteInvoiceForRoute: palsu.deleteInvoiceForRoute,
}));

import { createRouteServiceError } from "@/lib/api/route-service-error";
import { DELETE, PUT } from "@/app/api/invoices/[id]/route";

const CONTEXT = {
  params: { id: "inv-1" },
  permissions: ["invoices:update"],
  session: { user: { id: "admin-1", role: "ADMIN" } },
} as never;

const cancelRequest = () =>
  new NextRequest("http://localhost/api/invoices/inv-1", {
    method: "PUT",
    body: JSON.stringify({ status: "CANCELLED" }),
  });

const deleteRequest = () =>
  new NextRequest("http://localhost/api/invoices/inv-1", { method: "DELETE" });

describe("ubah dan hapus tagihan yang ditolak layanan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUT menjawab 409 dengan alasan tagihan tidak dibatalkan", async () => {
    const message =
      "Tagihan INV-1 tidak dibatalkan karena ada bukti transfer yang menunggu verifikasi; setujui atau tolak dulu di Verifikasi Pembayaran Manual.";
    palsu.updateInvoiceForRoute.mockRejectedValue(
      createRouteServiceError(message, 409),
    );

    const response = await PUT(cancelRequest(), CONTEXT);

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 409,
      body: { success: false, error: message },
    });
  });

  it("DELETE menjawab 409 dengan alasan tagihan tidak dihapus", async () => {
    const message =
      "Tagihan punya bukti transfer yang belum diverifikasi; tolak atau setujui dulu.";
    palsu.deleteInvoiceForRoute.mockRejectedValue(
      createRouteServiceError(message, 409),
    );

    const response = await DELETE(deleteRequest(), CONTEXT);

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 409,
      body: { success: false, error: message },
    });
  });

  it("galat lain tetap diserahkan ke createHandler", async () => {
    palsu.deleteInvoiceForRoute.mockRejectedValue(
      new Error("billing DB putus"),
    );

    await expect(DELETE(deleteRequest(), CONTEXT)).rejects.toThrow(
      "billing DB putus",
    );
  });
});
