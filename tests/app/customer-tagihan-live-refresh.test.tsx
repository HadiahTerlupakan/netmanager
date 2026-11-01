// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentMethod } from "@/app/(customer)/tagihan/checkout";
import {
  useTagihanLiveUpdates,
  type PaidSummary,
  type ShownCheckout,
} from "@/app/(customer)/tagihan/useTagihanLiveUpdates";
import { ToastProvider } from "@/components/ui/Toast";
import { flushPromises, jsonResponse, waitUntil } from "../helpers/portal-dom";

const sumber: EventSourcePalsu[] = [];
class EventSourcePalsu {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    sumber.push(this);
  }
  close() {
    this.closed = true;
  }
  kirim(data: object) {
    act(() => this.onmessage?.({ data: JSON.stringify(data) }));
  }
}

const INVOICE = {
  id: "inv-1",
  invoiceNumber: "INV-1",
  remainingAmount: 100000,
  lastPayment: { id: "p1", gatewayStatus: "PENDING" },
};

// Checkout dua tagihan dengan kupon: Duitku menagih 180.000, bukan sisa
// tagihan pertama (100.000).
const CHECKOUT: ShownCheckout = {
  invoiceId: "inv-1",
  summary: {
    amount: 180000,
    invoiceNumber: "INV-1, INV-2",
    methodName: "BCA Virtual Account",
  },
};

const METHODS: PaymentMethod[] = [
  {
    id: "duitku_bca",
    name: "BCA Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BC",
    group: "Virtual Account",
  },
  {
    id: "duitku_qris",
    name: "QRIS (Gopay, OVO, Dana, LinkAja)",
    provider: "DUITKU",
    type: "QRIS",
    code: "SP",
    group: "E-Wallet & QRIS",
  },
];

type Props = {
  shownCheckout?: ShownCheckout;
  outstandingInvoiceIds: string[];
  watched?: typeof INVOICE;
};

/**
 * Halaman tagihan dulu hanya mengandalkan satu aliran SSE yang ditutup pada
 * galat apa pun, tanpa memuat ulang saat tab dibuka lagi, sehingga pelunasan
 * baru terlihat setelah halaman dimuat ulang.
 */
describe("useTagihanLiveUpdates", () => {
  let container: HTMLDivElement;
  let root: Root;
  const refetch = vi.fn(async () => undefined);
  const onPaid = vi.fn<(summary: PaidSummary) => void>();
  const fetchMock = vi.fn();

  function Pemantau(props: Props): null {
    useTagihanLiveUpdates({
      watchedInvoice: props.watched,
      shownCheckout: props.shownCheckout,
      outstandingInvoiceIds: props.outstandingInvoiceIds,
      methods: METHODS,
      refetch,
      onPaid,
    });
    return null;
  }

  function pasang(props: Props) {
    act(() =>
      root.render(
        <ToastProvider>
          <Pemantau {...props} />
        </ToastProvider>,
      ),
    );
  }

  beforeEach(() => {
    sumber.length = 0;
    refetch.mockClear();
    onPaid.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("EventSource", EventSourcePalsu);
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("muat ulang", () => {
    beforeEach(() => vi.useFakeTimers());

    it("tiap 15 detik selama checkout menunggu ditampilkan", () => {
      pasang({ shownCheckout: CHECKOUT, outstandingInvoiceIds: ["inv-1"] });

      act(() => vi.advanceTimersByTime(14_999));
      expect(refetch).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(refetch).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(15_000));
      expect(refetch).toHaveBeenCalledTimes(2);
    });

    it("tidak berkala bila tidak ada checkout yang menunggu", () => {
      pasang({ outstandingInvoiceIds: ["inv-1"] });

      act(() => vi.advanceTimersByTime(60_000));

      expect(refetch).not.toHaveBeenCalled();
    });

    it("sekali saat pelanggan kembali ke tab, walau focus dan visibilitychange datang bersamaan", () => {
      pasang({ outstandingInvoiceIds: ["inv-1"] });

      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  it("lunas lewat SSE tanpa data server memakai total checkout yang tampil, bukan sisa tagihan pertama", async () => {
    pasang({
      watched: INVOICE,
      shownCheckout: CHECKOUT,
      outstandingInvoiceIds: ["inv-1", "inv-2"],
    });

    sumber[0].kirim({ status: "PAID", paymentId: "p1", gatewayStatus: "PAID" });
    await waitUntil(() => onPaid.mock.calls.length > 0);

    expect(onPaid).toHaveBeenCalledWith(CHECKOUT.summary);
    expect(refetch).toHaveBeenCalled();
  });

  // Uji produksi 2026-11-01: QR lama dibayar setelah pelanggan pindah ke
  // LinkAja, dan layar sukses menulis metode serta nominal checkout yang
  // sedang tampil, bukan yang membayar.
  it("layar sukses memakai pembayaran yang dicatat server, bukan checkout yang tampil", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          invoices: [
            {
              id: "inv-1",
              invoiceNumber: "INV-1",
              lastPayment: {
                amount: 90000,
                date: "2026-11-01T01:44:39.000Z",
                method: "E_WALLET",
                gatewayStatus: "PAID",
                gatewayProvider: "SP",
                checkoutTotal: 162000,
                checkoutInvoiceNumbers: ["INV-1", "INV-2"],
              },
            },
          ],
        },
      }),
    );
    pasang({
      watched: INVOICE,
      shownCheckout: CHECKOUT,
      outstandingInvoiceIds: ["inv-1", "inv-2"],
    });

    sumber[0].kirim({ status: "PAID", paymentId: "p1", gatewayStatus: "PAID" });
    await waitUntil(() => onPaid.mock.calls.length > 0);

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith({
      amount: 162000,
      invoiceNumber: "INV-1, INV-2",
      methodName: "QRIS (Gopay, OVO, Dana, LinkAja)",
    });
  });

  it("checkout yang hilang dari daftar dan ternyata lunas menampilkan layar sukses", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { invoices: [{ id: "inv-1" }] } }),
    );
    pasang({ shownCheckout: CHECKOUT, outstandingInvoiceIds: ["inv-1"] });

    pasang({ outstandingInvoiceIds: [] });
    await flushPromises();

    expect(String(fetchMock.mock.calls[0][0])).toContain("status=PAID");
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(CHECKOUT.summary);
  });

  it("checkout yang hilang tetapi tidak lunas (mis. dibatalkan admin) tidak dirayakan", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { invoices: [] } }),
    );
    pasang({ shownCheckout: CHECKOUT, outstandingInvoiceIds: ["inv-1"] });

    pasang({ outstandingInvoiceIds: [] });
    await flushPromises();

    expect(onPaid).not.toHaveBeenCalled();
  });

  it("layar sukses tidak muncul dua kali untuk tagihan yang sama", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { invoices: [{ id: "inv-1" }] } }),
    );
    pasang({
      watched: INVOICE,
      shownCheckout: CHECKOUT,
      outstandingInvoiceIds: ["inv-1"],
    });
    sumber[0].kirim({ status: "PAID", paymentId: "p1", gatewayStatus: "PAID" });

    pasang({ outstandingInvoiceIds: [] });
    await flushPromises();

    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  // Uji produksi 2026-11-01: pelanggan membatalkan transfer manualnya
  // sendiri lalu membaca "Pembayaran tidak berhasil".
  it("checkout yang dibatalkan tidak disebut gagal", () => {
    pasang({
      watched: INVOICE,
      shownCheckout: CHECKOUT,
      outstandingInvoiceIds: ["inv-1"],
    });

    sumber[0].kirim({
      status: "SENT",
      paymentId: "p1",
      gatewayStatus: "CANCELLED",
    });

    expect(document.body.textContent).toContain("Pembayaran dibatalkan");
    expect(document.body.textContent).not.toContain("tidak berhasil");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  describe("checkout terbaru berbeda dari yang ditampilkan", () => {
    const NOTICE = "Metode pembayaran diperbarui";

    it("ganti metode yang gagal hanya memuat ulang, tanpa menyuruh memakai instruksi baru", () => {
      pasang({
        watched: INVOICE,
        shownCheckout: CHECKOUT,
        outstandingInvoiceIds: ["inv-1"],
      });

      sumber[0].kirim({
        status: "OVERDUE",
        paymentId: "p2",
        gatewayStatus: "FAILED",
      });

      expect(document.body.textContent).not.toContain(NOTICE);
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("checkout baru yang menunggu dibayar diberitahukan", () => {
      pasang({
        watched: INVOICE,
        shownCheckout: CHECKOUT,
        outstandingInvoiceIds: ["inv-1"],
      });

      sumber[0].kirim({
        status: "OVERDUE",
        paymentId: "p2",
        gatewayStatus: "PENDING",
      });

      expect(document.body.textContent).toContain(NOTICE);
    });
  });
});
