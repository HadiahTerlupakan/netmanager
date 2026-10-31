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
  uploadInventoryPhotos: vi.fn(),
  validateInventoryPhotos: vi.fn(),
}));

vi.mock("@/modules/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/modules/integrations")>(
    "@/modules/integrations",
  );

  return {
    ...actual,
    analyzeReceiptWithOCR: mockFns.analyzeReceiptWithOCR,
  };
});

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

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const RECEIPT_URL =
  "/uploads/tenants/tenant-1/payment-proofs/1700000000000-receipt_c1.webp";

function manualPayment(id: string, amount: bigint) {
  return {
    id,
    checkoutId: "c1",
    invoiceId: `inv-${id}`,
    pelangganId: "customer-1",
    amount,
    notes: null as string | null,
    receiptUrl: null as string | null,
    couponUsageId: null as string | null,
    couponId: null as string | null,
    tenantId: "tenant-1",
  };
}

function uploadRequest(file: File, invoiceId = "invoice-1") {
  const formData = new FormData();
  formData.append("invoiceId", invoiceId);
  formData.append("file", file);
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

const imageFile = (
  header: number[],
  type = "image/png",
  size = header.length + 4,
) =>
  new File(
    [Uint8Array.from([...header, ...new Array(size - header.length).fill(0)])],
    "receipt",
    {
      type,
    },
  );

let sessionNumber = 0;

describe("customer upload receipt route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Sesi berbeda per tes: pembatas laju menghitung per pelanggan.
    sessionNumber += 1;
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: {
        id: `customer-${sessionNumber}`,
        idPelanggan: "pelanggan-1",
      },
      response: undefined,
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      checkoutId: "c1",
    });
    prismaMock.payment.findMany.mockResolvedValue([
      manualPayment("payment-1", 125000n),
    ]);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
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

    mockFns.convertAndSaveImage.mockResolvedValue(RECEIPT_URL);
    mockFns.getAdminTokens.mockResolvedValue([]);
    mockFns.sendFCMNotification.mockResolvedValue(undefined);
  });

  it("publishes the pending payment update through canonical Firebase realtime without using the socket producer", async () => {
    const deferredPublish = createDeferred<void>();
    mockFns.publish.mockReturnValueOnce(deferredPublish.promise);

    const responsePromise = POST(uploadRequest(imageFile(PNG)));

    const result = await Promise.race([
      responsePromise.then(() => "response"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 0)),
    ]);

    expect(result).toBe("response");
    const payload = {
      id: "payment-1",
      amount: 125000,
      pelangganId: `customer-${sessionNumber}`,
      message: "Struk pembayaran baru diunggah",
    };
    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "payment.pending.new",
      scope: { kind: "admin", id: "notifications.site.site-1" },
      payload,
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "payment.pending.new",
      scope: { kind: "admin", id: "notifications" },
      payload,
    });

    deferredPublish.resolve(undefined);
    await responsePromise;
  });

  // Checkout dua invoice dulu hanya melampirkan bukti ke satu payment, dan
  // OCR mencocokkan nominal satu invoice dengan transfer totalnya.
  it("bukti dilampirkan ke setiap invoice checkout dan dicocokkan dengan totalnya", async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      manualPayment("payment-1", 100000n),
      manualPayment("payment-2", 25000n),
    ]);

    const response = await POST(uploadRequest(imageFile(PNG)));

    expect(response.status).toBe(200);
    const attached = prismaMock.payment.updateMany.mock.calls.map(
      ([args]) => (args as { where: { id: string }; data: unknown }).where.id,
    );
    expect(attached).toEqual(["payment-1", "payment-2"]);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-2", gatewayStatus: "PENDING", verifiedAt: null },
      data: {
        receiptUrl: RECEIPT_URL,
        notes: expect.stringContaining("Nominal sesuai (Rp125.000)"),
      },
    });
  });

  it("menyimpan bukti di direktori privat milik tenant, bukan public/receipts", async () => {
    await POST(uploadRequest(imageFile(PNG)));

    expect(mockFns.convertAndSaveImage).toHaveBeenCalledWith(
      expect.any(File),
      "public/uploads/tenants/tenant-1/payment-proofs",
      expect.stringMatching(/^receipt_c1_\d+$/),
      "payment-proofs",
    );
  });

  it("menolak isi berkas yang bukan gambar walau MIME-nya image/png", async () => {
    const response = await POST(
      uploadRequest(
        new File([Uint8Array.from([1, 2, 3])], "receipt.png", {
          type: "image/png",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("menerima JPEG kamera yang dikirim tanpa MIME gambar", async () => {
    const response = await POST(
      uploadRequest(imageFile(JPEG, "application/octet-stream")),
    );

    expect(response.status).toBe(200);
    expect(mockFns.analyzeReceiptWithOCR).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      "image/jpeg",
      "tenant-1",
    );
  });

  it("menolak gambar lebih dari 5 MB", async () => {
    const response = await POST(
      uploadRequest(imageFile(PNG, "image/png", 5 * 1024 * 1024 + 1)),
    );

    expect(response.status).toBe(400);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("404 bila tagihan tidak punya transfer manual yang menunggu", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);

    const response = await POST(uploadRequest(imageFile(PNG)));

    expect(response.status).toBe(404);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("membatasi unggahan berulang dari pelanggan yang sama", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await POST(uploadRequest(imageFile(PNG)))).status);
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
