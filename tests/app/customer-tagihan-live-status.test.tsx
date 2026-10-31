// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  gatewayReturnNotice,
  usePaymentLiveStatus,
  type PaymentLiveHandlers,
} from "@/app/(customer)/tagihan/usePaymentLiveStatus";

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
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
vi.stubGlobal("EventSource", EventSourcePalsu);

function Pemantau(props: {
  shown: { paymentId?: string; gatewayStatus?: string };
  handlers: PaymentLiveHandlers;
}): null {
  usePaymentLiveStatus("inv-1", props.shown, props.handlers);
  return null;
}

/**
 * Halaman tagihan yang terbuka di perangkat lain dulu tetap menampilkan VA
 * lama setelah pelanggan mengganti metode, dan checkout yang kedaluwarsa
 * tidak memberi tahu apa pun.
 */
describe("usePaymentLiveStatus", () => {
  let container: HTMLDivElement;
  let root: Root;
  const handlers = {
    onPaid: vi.fn(),
    onReplaced: vi.fn(),
    onEnded: vi.fn(),
  };

  beforeEach(() => {
    sumber.length = 0;
    vi.clearAllMocks();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  function pasang(shown: { paymentId?: string; gatewayStatus?: string }) {
    act(() => root.render(<Pemantau shown={shown} handlers={handlers} />));
    return sumber[sumber.length - 1];
  }

  it("lunas memanggil onPaid sekali lalu menutup aliran", () => {
    const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

    es.kirim({ status: "PAID", paymentId: "p1", gatewayStatus: "PAID" });
    es.kirim({ status: "PAID", paymentId: "p1", gatewayStatus: "PAID" });

    expect(handlers.onPaid).toHaveBeenCalledTimes(1);
    expect(es.closed).toBe(true);
    expect(es.url).toBe("/api/customer/payments/sse?invoiceId=inv-1");
  });

  it("checkout terbaru yang berbeda berarti metode diganti di tempat lain", () => {
    const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

    es.kirim({ status: "OVERDUE", paymentId: "p2", gatewayStatus: "PENDING" });
    es.kirim({ status: "OVERDUE", paymentId: "p2", gatewayStatus: "PENDING" });

    expect(handlers.onReplaced).toHaveBeenCalledTimes(1);
    expect(handlers.onReplaced).toHaveBeenCalledWith("PENDING");
    expect(handlers.onEnded).not.toHaveBeenCalled();
  });

  it("checkout yang sedang ditampilkan kedaluwarsa", () => {
    const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

    es.kirim({ status: "EXPIRED", paymentId: "p1", gatewayStatus: "EXPIRED" });

    expect(handlers.onEnded).toHaveBeenCalledWith("EXPIRED");
  });

  it("status yang sama tidak memicu apa pun", () => {
    const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

    es.kirim({ status: "OVERDUE", paymentId: "p1", gatewayStatus: "PENDING" });

    expect(handlers.onPaid).not.toHaveBeenCalled();
    expect(handlers.onReplaced).not.toHaveBeenCalled();
    expect(handlers.onEnded).not.toHaveBeenCalled();
  });

  /**
   * Aliran dulu ditutup pada galat apa pun, dan server sendiri mengakhirinya
   * setelah 30 menit; pelunasan sesudahnya baru terlihat setelah muat ulang.
   */
  describe("sambung ulang", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function putus(es: EventSourcePalsu) {
      act(() => es.onerror?.());
    }

    function tunggu(ms: number) {
      act(() => vi.advanceTimersByTime(ms));
    }

    it("tersambung lagi dengan jeda yang makin panjang", () => {
      const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

      putus(es);
      expect(es.closed).toBe(true);
      expect(sumber).toHaveLength(1);
      tunggu(1000);
      expect(sumber).toHaveLength(2);

      putus(sumber[1]);
      tunggu(1000);
      expect(sumber).toHaveLength(2);
      tunggu(1000);
      expect(sumber).toHaveLength(3);
    });

    it("pesan yang masuk mengembalikan jeda ke awal", () => {
      const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });
      putus(es);
      tunggu(1000);
      putus(sumber[1]);
      tunggu(2000);

      sumber[2].kirim({
        status: "OVERDUE",
        paymentId: "p1",
        gatewayStatus: "PENDING",
      });
      putus(sumber[2]);
      tunggu(1000);

      expect(sumber).toHaveLength(4);
    });

    it("pelunasan setelah aliran diakhiri server tetap terlihat", () => {
      const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

      putus(es);
      tunggu(1000);
      sumber[1].kirim({
        status: "PAID",
        paymentId: "p1",
        gatewayStatus: "PAID",
      });

      expect(handlers.onPaid).toHaveBeenCalledTimes(1);
    });

    it("setelah lunas tidak menyambung lagi", () => {
      const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

      es.kirim({ status: "PAID", paymentId: "p1", gatewayStatus: "PAID" });
      putus(es);
      tunggu(60_000);

      expect(sumber).toHaveLength(1);
    });

    it("halaman yang ditinggalkan tidak menyambung lagi", () => {
      const es = pasang({ paymentId: "p1", gatewayStatus: "PENDING" });

      putus(es);
      act(() => root.render(<></>));
      tunggu(60_000);

      expect(sumber).toHaveLength(1);
    });
  });
});

describe("gatewayReturnNotice", () => {
  it.each([
    ["00", "info", "Memeriksa"],
    ["02", "warning", "dibatalkan"],
    ["01", "info", "belum selesai"],
  ])("resultCode %s", (code, type, text) => {
    const [kind, message] = gatewayReturnNotice(code);
    expect(kind).toBe(type);
    expect(message).toContain(text);
  });
});
