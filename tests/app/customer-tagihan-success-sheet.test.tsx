// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { PaymentSuccessSheet } from "@/app/(customer)/tagihan/PaymentSuccessSheet";

// Dulu pelunasan hanya ditandai alert() bawaan browser.
describe("PaymentSuccessSheet", () => {
  it("menampilkan ringkasan pembayaran dan tombolnya berfungsi", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onClose = vi.fn();
    const onHome = vi.fn();

    act(() =>
      root.render(
        <PaymentSuccessSheet
          amount="Rp 11.100"
          invoiceNumber="INV/2026/10/28-F23DCAF1624B"
          methodName="QRIS (Gopay, OVO, Dana, LinkAja)"
          onClose={onClose}
          onHome={onHome}
        />,
      ),
    );

    const text = container.textContent ?? "";
    expect(text).toContain("Pembayaran Berhasil");
    expect(text).toContain("Rp 11.100");
    expect(text).toContain("INV/2026/10/28-F23DCAF1624B");
    expect(text).toContain("QRIS");
    const buttons = [...container.querySelectorAll("button")];
    act(() => buttons.find((b) => b.textContent === "Lihat Riwayat")?.click());
    act(() => buttons.find((b) => b.textContent === "Ke Beranda")?.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
