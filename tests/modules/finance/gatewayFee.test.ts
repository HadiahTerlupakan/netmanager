import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({ checkStatus: vi.fn() }));

vi.mock("@/modules/payment-gateway/services/PaymentGatewayService", () => ({
  PaymentGatewayManager: class {
    checkPaymentStatus = palsu.checkStatus;
  },
}));

import { recordGatewayFee } from "@/modules/payment-gateway/services/gateway-fee";
import { gatewayTransactionIdFromUrl } from "@/modules/finance/services/PaymentGatewayTransactionService";

const PAYMENT = { id: "p1", reference: "PAY-1", tenantId: "t1" };

// Duitku mengirim biaya hanya lewat cek status ("fee":"78.00"); tanpanya
// admin tidak tahu jumlah yang benar-benar diterima.
describe("biaya gateway", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disimpan dari cek status gateway", async () => {
    palsu.checkStatus.mockResolvedValue({ status: "PAID", fee: 78 });

    await recordGatewayFee("DUITKU", PAYMENT);

    expect(palsu.checkStatus).toHaveBeenCalledWith("DUITKU", "PAY-1", "t1");
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { gatewayFee: 78n },
    });
  });

  it("gateway yang tidak melaporkan biaya tidak mengubah apa pun", async () => {
    palsu.checkStatus.mockResolvedValue({ status: "PAID" });

    await recordGatewayFee("TRIPAY", PAYMENT);

    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it("cek status yang gagal tidak menggagalkan pelunasan", async () => {
    palsu.checkStatus.mockRejectedValue(new Error("timeout"));

    await expect(recordGatewayFee("DUITKU", PAYMENT)).resolves.toBeUndefined();
  });
});

describe("PG Transaction ID", () => {
  it("diambil dari parameter ref URL bayar Duitku", () => {
    expect(
      gatewayTransactionIdFromUrl(
        "https://sandbox.duitku.com/topup/topupdirectv2.aspx?ref=BC261EVTS1N27GPDQE5",
      ),
    ).toBe("BC261EVTS1N27GPDQE5");
    expect(gatewayTransactionIdFromUrl(null)).toBeNull();
    expect(gatewayTransactionIdFromUrl("bukan url")).toBeNull();
  });
});
