import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  checkCustomerPaymentStatus: vi.fn(),
  cancelCustomerManualCheckout: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));

vi.mock("@/modules/pelanggan", () => ({
  checkCustomerPaymentStatus: mockFns.checkCustomerPaymentStatus,
  cancelCustomerManualCheckout: mockFns.cancelCustomerManualCheckout,
}));

import { POST as checkStatus } from "@/app/api/customer/payments/check-status/route";
import { POST as cancelPayment } from "@/app/api/customer/payments/cancel/route";
import { RouteServiceError } from "@/lib/api/route-service-error";

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

let sessionNumber = 0;

describe("rute checkout pelanggan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sesi berbeda per tes: pembatas laju menghitung per pelanggan.
    sessionNumber += 1;
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: `customer-${sessionNumber}`, idPelanggan: "PLG-1" },
    });
  });

  describe("POST /api/customer/payments/check-status", () => {
    it("menjawab status dari service untuk pelanggan sesi", async () => {
      mockFns.checkCustomerPaymentStatus.mockResolvedValue("PAID");

      const response = await checkStatus(
        jsonRequest("/api/customer/payments/check-status", {
          invoiceId: "inv-1",
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: { status: "PAID" },
      });
      expect(mockFns.checkCustomerPaymentStatus).toHaveBeenCalledWith({
        customerId: `customer-${sessionNumber}`,
        invoiceId: "inv-1",
      });
    });

    it("menolak tanpa invoiceId", async () => {
      const response = await checkStatus(
        jsonRequest("/api/customer/payments/check-status", {}),
      );

      expect(response.status).toBe(400);
      expect(mockFns.checkCustomerPaymentStatus).not.toHaveBeenCalled();
    });

    it("tanpa sesi tidak bertanya ke gateway", async () => {
      mockFns.requireCustomerAuth.mockResolvedValue({
        response: NextResponse.json({}, { status: 401 }),
      });

      const response = await checkStatus(
        jsonRequest("/api/customer/payments/check-status", {
          invoiceId: "inv-1",
        }),
      );

      expect(response.status).toBe(401);
      expect(mockFns.checkCustomerPaymentStatus).not.toHaveBeenCalled();
    });

    // Duitku memblokir merchant bila cek status terlalu sering.
    it("membatasi cek status berulang dari pelanggan yang sama", async () => {
      mockFns.checkCustomerPaymentStatus.mockResolvedValue("PENDING");
      const statuses: number[] = [];
      for (let i = 0; i < 13; i += 1) {
        const response = await checkStatus(
          jsonRequest("/api/customer/payments/check-status", {
            invoiceId: "inv-1",
          }),
        );
        statuses.push(response.status);
      }

      expect(statuses.filter((status) => status === 200)).toHaveLength(12);
      expect(statuses.at(-1)).toBe(429);
    });
  });

  describe("POST /api/customer/payments/cancel", () => {
    it("membatalkan transfer manual pelanggan sesi", async () => {
      mockFns.cancelCustomerManualCheckout.mockResolvedValue(undefined);

      const response = await cancelPayment(
        jsonRequest("/api/customer/payments/cancel", { invoiceId: "inv-1" }),
      );

      expect(response.status).toBe(200);
      expect((await response.json()).success).toBe(true);
      expect(mockFns.cancelCustomerManualCheckout).toHaveBeenCalledWith({
        customerId: `customer-${sessionNumber}`,
        invoiceId: "inv-1",
      });
    });

    it("tanpa transfer manual yang bisa dibatalkan dijawab 409 berpesan", async () => {
      mockFns.cancelCustomerManualCheckout.mockRejectedValue(
        new RouteServiceError(
          "Tidak ada transfer manual menunggu yang bisa dibatalkan untuk tagihan ini.",
          409,
        ),
      );

      const response = await cancelPayment(
        jsonRequest("/api/customer/payments/cancel", { invoiceId: "inv-1" }),
      );

      expect(response.status).toBe(409);
      expect((await response.json()).error).toMatch(
        /tidak ada transfer manual/i,
      );
    });
  });
});
