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
