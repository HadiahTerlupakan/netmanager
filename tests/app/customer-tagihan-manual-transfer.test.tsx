// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => {
  const { router } = await import("../fixtures/tagihan-page");
  return { useRouter: () => router };
});
vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock("@/components/customer/CustomerNotificationBell", () => ({
  CustomerNotificationBell: (): null => null,
}));
vi.mock("@/components/ui/InfiniteScrollSentinel", () => ({
  InfiniteScrollSentinel: (): null => null,
}));
vi.mock("@/lib/hooks/useInfiniteApi", async () => ({
  useInfiniteApi: (await import("../fixtures/tagihan-page"))
    .useInfiniteApiTiruan,
}));
vi.mock("@/lib/hooks/useApi", async () => ({
  useApi: (await import("../fixtures/tagihan-page")).useApiTiruan,
}));

import CustomerInvoicesPage from "@/app/(customer)/tagihan/page";
import { ToastProvider } from "@/components/ui/Toast";
import {
  EventSourceDiam,
  METODE_BCA,
  REKENING_BCA,
  buatInvoice,
  resetTagihanApi,
  tagihanApi,
  transferManual,
} from "../fixtures/tagihan-page";
import {
  chooseFile,
  click,
  findButton,
  flushPromises,
  getButton,
  jsonResponse,
} from "../helpers/portal-dom";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function teks(element: Element | null = document.body) {
  return (element?.textContent ?? "").replace(/ /g, " ");
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function inputBerkas(selector: string) {
  return document.querySelector<HTMLInputElement>(
    `input[type="file"]${selector}`,
  )!;
}

function fotoBukti(size = 1024) {
  return new File([new Uint8Array(size)], "bukti.jpg", { type: "image/jpeg" });
}

describe("halaman tagihan pelanggan: transfer manual", () => {
  let root: Root;
  let container: HTMLDivElement;
  const fetchMock = vi.fn();

  async function render() {
    await act(async () =>
      root.render(
        <ToastProvider>
          <CustomerInvoicesPage />
        </ToastProvider>,
      ),
    );
  }

  beforeEach(() => {
    resetTagihanApi();
    tagihanApi.methods = [REKENING_BCA, METODE_BCA];
    fetchMock.mockReset();
    vi.stubGlobal("EventSource", EventSourceDiam);
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("nominal transfer adalah total checkout, dan itu yang disalin", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    tagihanApi.invoices = [
      buatInvoice({
        lastPayment: transferManual({
          amount: 50000,
          checkoutTotal: 150000,
          checkoutInvoiceNumbers: ["INV-001", "INV-002"],
        }),
      }),
    ];
    await render();

    expect(teks()).toContain("Rp 150.000");
    expect(teks()).toContain("INV-002");
    await click(getButton("Salin nominal transfer"));
    expect(writeText).toHaveBeenCalledWith("150000");
  });

  // Dulu tidak ada jalan keluar dari transfer manual yang menunggu.
  describe("Batalkan / Ganti Metode", () => {
    async function batalkan() {
      tagihanApi.invoices = [buatInvoice({ lastPayment: transferManual() })];
      await render();
      await click(getButton("Batalkan / Ganti Metode"));
      expect(teks()).toContain("Sudah terlanjur transfer?");
      await click(getButton("Ya, Batalkan"));
      await flushPromises();
    }

    it("membatalkan lewat server lalu membuka pilihan metode", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ success: true }));

      await batalkan();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/customer/payments/cancel");
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({
        invoiceId: "invoice-1",
      });
      expect(tagihanApi.refetchInvoices).toHaveBeenCalled();
      expect(teks(dialog())).toContain("Rincian Pembayaran");
    });

    it("penolakan server ditampilkan dan pilihan metode tidak dibuka", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { success: false, error: "Transfer ini sudah diverifikasi admin" },
          409,
        ),
      );

      await batalkan();

      expect(teks()).toContain("Transfer ini sudah diverifikasi admin");
      expect(dialog()).toBeNull();
    });
  });

  describe("bukti transfer", () => {
    it("kamera HP bisa dipakai untuk memotret bukti, galeri tetap tersedia", async () => {
      tagihanApi.invoices = [buatInvoice({ lastPayment: transferManual() })];
      await render();

      const kamera = inputBerkas('[capture="environment"]');
      const galeri = inputBerkas(":not([capture])");
      expect(kamera.accept).toBe("image/*");
      expect(galeri.accept).toBe("image/*");
      expect(findButton("Ambil Foto")).toBeDefined();
      expect(findButton("Unggah Bukti Transfer")).toBeDefined();
    });

    it("bukti yang belum diverifikasi bisa diganti", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ success: true }));
      tagihanApi.invoices = [
        buatInvoice({
          lastPayment: transferManual({ receiptUrl: "/uploads/bukti-1.jpg" }),
        }),
      ];
      await render();
      expect(teks()).toContain("Menunggu Verifikasi Admin");
      expect(findButton("Ganti Bukti Transfer")).toBeDefined();

      await chooseFile(inputBerkas(":not([capture])"), fotoBukti());
      await flushPromises();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/customer/payments/upload-receipt");
      expect((init.body as FormData).get("invoiceId")).toBe("invoice-1");
      expect(tagihanApi.refetchInvoices).toHaveBeenCalled();
    });

    it("foto di atas 5 MB ditolak sebelum diunggah", async () => {
      tagihanApi.invoices = [buatInvoice({ lastPayment: transferManual() })];
      await render();

      await chooseFile(
        inputBerkas('[capture="environment"]'),
        fotoBukti(MAX_RECEIPT_BYTES + 1),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(teks()).toContain("maksimal 5 MB");
    });
  });

  describe("bukti ditolak admin", () => {
    it("menampilkan alasan penolakan dan pelanggan bisa membayar lagi", async () => {
      tagihanApi.invoices = [
        buatInvoice({
          lastPayment: transferManual({
            gatewayStatus: "FAILED",
            rejectionReason: "Nominal transfer tidak sesuai",
          }),
        }),
      ];
      await render();

      expect(teks()).toContain("Bukti transfer ditolak admin");
      expect(teks()).toContain("Nominal transfer tidak sesuai");
      await click(getButton("Bayar Sekarang"));
      expect(teks(dialog())).toContain("Rincian Pembayaran");
    });

    it("server lama tanpa isManual dikenali dari accountId", async () => {
      tagihanApi.invoices = [
        buatInvoice({
          lastPayment: transferManual({
            gatewayStatus: "FAILED",
            isManual: undefined,
          }),
        }),
      ];
      await render();

      expect(teks()).toContain("Bukti transfer ditolak admin");
    });
  });

  // Rekening yang dinonaktifkan admin dulu membuat kartu transfer manual
  // berubah menjadi kartu gateway tanpa instruksi.
  it("rekening tujuan yang sudah dinonaktifkan tidak berubah menjadi kartu gateway", async () => {
    tagihanApi.invoices = [
      buatInvoice({ lastPayment: transferManual({ accountId: "bank-lama" }) }),
    ];
    await render();

    expect(teks()).toContain(
      "Rekening tujuan pembayaran ini sudah tidak aktif",
    );
    expect(teks()).toContain("Rp 100.000");
    expect(findButton("Ganti Metode Pembayaran")).toBeUndefined();
    expect(findButton("Lanjutkan ke Halaman Pembayaran")).toBeUndefined();
    expect(findButton("Batalkan / Ganti Metode")).toBeDefined();
  });
});
