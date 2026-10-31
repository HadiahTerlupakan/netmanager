// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const bellMocks = vi.hoisted(() => ({
  usePermission: vi.fn(),
  useRealtimePaymentApprovals: vi.fn(),
  useClickOutside: vi.fn(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: bellMocks.usePermission,
}));

vi.mock("@/lib/websocket/hooks/useRealtimePaymentApprovals", () => ({
  useRealtimePaymentApprovals: bellMocks.useRealtimePaymentApprovals,
}));

vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: bellMocks.useClickOutside,
}));

import { PaymentApprovalBell } from "@/components/notifications/PaymentApprovalBell";
import type { PendingPayment } from "@/lib/websocket/hooks/useRealtimePaymentApprovals";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function pendingPayment(id: string, createdAt: string): PendingPayment {
  return {
    id,
    amount: 150_000,
    method: "TRANSFER",
    status: "PENDING",
    receiptUrl: "/receipt.jpg",
    createdAt,
    customerName: "Pelanggan",
    invoice: null,
  };
}

/** Render ulang lonceng dengan daftar pending yang berubah, lalu hitung nadanya. */
function countSoundsFor(paymentLists: PendingPayment[][]) {
  const play = vi.fn(() => Promise.resolve());
  vi.stubGlobal(
    "Audio",
    vi.fn(function (this: { play: typeof play }) {
      this.play = play;
    }),
  );
  bellMocks.usePermission.mockReturnValue({ hasPermission: () => true });
  const root = createRoot(document.createElement("div"));

  for (const payments of paymentLists) {
    bellMocks.useRealtimePaymentApprovals.mockReturnValue({
      payments,
      loading: false,
      isConnected: true,
      refresh: vi.fn(),
    });
    act(() => root.render(<PaymentApprovalBell />));
  }

  act(() => root.unmount());
  vi.unstubAllGlobals();
  return play.mock.calls.length;
}

describe("PaymentApprovalBell", () => {
  it("does not render or fetch pending payments without manual payment read permission", () => {
    bellMocks.usePermission.mockReturnValue({
      hasPermission: () => false,
    });
    bellMocks.useRealtimePaymentApprovals.mockReturnValue({
      payments: [],
      loading: false,
      isConnected: false,
      refresh: vi.fn(),
    });

    const markup = renderToStaticMarkup(<PaymentApprovalBell />);

    expect(markup).toBe("");
    expect(bellMocks.useRealtimePaymentApprovals).not.toHaveBeenCalled();
  });

  it("rings for a newer pending payment, not for the ones already there", () => {
    localStorage.clear();
    const first = pendingPayment("pay-1", "2026-11-01T08:00:00.000Z");
    const newer = pendingPayment("pay-2", "2026-11-01T08:05:00.000Z");

    expect(countSoundsFor([[first], [newer, first]])).toBe(1);
  });

  it("stays silent for a newer pending payment when the staff ringtone is off", () => {
    localStorage.setItem("chat_sound_enabled", "false");
    const first = pendingPayment("pay-1", "2026-11-01T08:00:00.000Z");
    const newer = pendingPayment("pay-2", "2026-11-01T08:05:00.000Z");

    expect(countSoundsFor([[first], [newer, first]])).toBe(0);
    localStorage.clear();
  });
});
