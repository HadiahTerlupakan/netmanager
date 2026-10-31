// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { PaymentSuccessSheet } from "@/app/(customer)/tagihan/PaymentSuccessSheet";
import { getButton } from "../helpers/portal-dom";

// Dulu pelunasan hanya ditandai alert() bawaan browser.
describe("PaymentSuccessSheet", () => {
  it("menampilkan ringkasan pembayaran dan tombolnya berfungsi", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();
    const onHistory = vi.fn();
    const onHome = vi.fn();

    act(() =>
      root.render(
        <PaymentSuccessSheet
          amount="Rp 11.100"
          invoiceNumber="INV/2026/10/28-F23DCAF1624B"
          methodName="QRIS (Gopay, OVO, Dana, LinkAja)"
          onClose={onClose}
          onHistory={onHistory}
          onHome={onHome}
        />,
      ),
    );

    const dialog = document.querySelector('[role="dialog"]')!;
    const text = dialog.textContent ?? "";
    expect(text).toContain("Pembayaran Berhasil");
    expect(text).toContain("Rp 11.100");
    expect(text).toContain("INV/2026/10/28-F23DCAF1624B");
    expect(text).toContain("QRIS");
    // Dulu tombol ini hanya menutup lembar.
    act(() => getButton("Lihat Riwayat").click());
    act(() => getButton("Ke Beranda").click());
    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
