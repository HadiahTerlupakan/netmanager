import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  convertAndSaveImage: vi.fn(),
  analyzeReceiptWithOCR: vi.fn(),
  publish: vi.fn(),
  getAdminTokens: vi.fn(),
  sendFCMNotification: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: mockFns.convertAndSaveImage,
}));

vi.mock("@/lib/services/receipt-ocr", () => ({
  analyzeReceiptWithOCR: mockFns.analyzeReceiptWithOCR,
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
}));

vi.mock("@/lib/firebase/messaging", () => ({
  getAdminTokens: mockFns.getAdminTokens,
  sendFCMNotification: mockFns.sendFCMNotification,
}));

import { POST } from "@/app/api/customer/payments/upload-receipt/route";

describe("customer upload receipt route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: "customer-1", idPelanggan: "pelanggan-1" },
      response: undefined,
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      invoiceId: "invoice-1",
      pelangganId: "customer-1",
      amount: 125000,
      notes: "",
      gatewayStatus: "PENDING",
      paymentMethod: "BANK_TRANSFER",
    });
    prismaMock.payment.update.mockResolvedValue({
      id: "payment-1",
      receiptUrl: "https://cdn.example.test/receipt.png",
    });
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "customer-1",
      siteId: "site-1",
    });

    mockFns.publish.mockResolvedValue(undefined);

    mockFns.analyzeReceiptWithOCR.mockResolvedValue({
      is_potentially_fake: false,
      is_valid_receipt: true,
      nominal: 125000,
      catatan_analisis: "Struk valid",
    });

    mockFns.convertAndSaveImage.mockResolvedValue(
      "https://cdn.example.test/receipt.png",
    );
    mockFns.getAdminTokens.mockResolvedValue([]);
    mockFns.sendFCMNotification.mockResolvedValue(undefined);
  });

  it("publishes the pending payment update through canonical Firebase realtime without using the socket producer", async () => {
    const deferredPublish = createDeferred<void>();
    mockFns.publish.mockReturnValueOnce(deferredPublish.promise);

    const formData = new FormData();
    formData.append("invoiceId", "invoice-1");
    formData.append(
      "file",
      new File([Uint8Array.from([1, 2, 3])], "receipt.png", {
        type: "image/png",
      }),
    );

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as NextRequest;

    const responsePromise = POST(request);

    const result = await Promise.race([
      responsePromise.then(() => "response"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 0)),
    ]);

    expect(result).toBe("response");
    expect(prismaMock.pelanggan.findUnique).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      select: { siteId: true },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "payment.pending.new",
      scope: { kind: "admin", id: "notifications.site.site-1" },
      payload: {
        id: "payment-1",
        amount: 125000,
        pelangganId: "customer-1",
        message: "Struk pembayaran baru diunggah",
      },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "payment.pending.new",
      scope: { kind: "admin", id: "notifications" },
      payload: {
        id: "payment-1",
        amount: 125000,
        pelangganId: "customer-1",
        message: "Struk pembayaran baru diunggah",
      },
    });

    deferredPublish.resolve(undefined);
    await responsePromise;
  });
});
