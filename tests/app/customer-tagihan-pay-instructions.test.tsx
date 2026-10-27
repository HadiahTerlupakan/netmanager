// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GatewayPayInstructions } from "@/app/(customer)/tagihan/GatewayPayInstructions";

/**
 * Pelanggan dulu selalu dialihkan ke halaman bayar Duitku; nomor VA dan QRIS
 * kini ditampilkan di portal sendiri.
 */
describe("GatewayPayInstructions", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onCopy = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onCopy.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("menampilkan nomor VA dengan tombol salin dan nominal tepat", async () => {
    await act(async () => {
      root.render(
        <GatewayPayInstructions
          amount="Rp 11.100"
          vaNumber="7007014002472496"
          methodName="BCA Virtual Account"
          methodType="VA"
          onCopy={onCopy}
        />,
      );
    });

    expect(container.textContent).toContain(
      "Nomor Virtual Account BCA Virtual Account",
    );
    expect(container.textContent).toContain("7007014002472496");
    expect(container.textContent).toContain("Rp 11.100");
    const copy = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Salin"),
    );
    act(() => copy?.click());
    expect(onCopy).toHaveBeenCalledWith(
      "7007014002472496",
      "Nomor Virtual Account",
    );
  });

  it("minimarket memakai label kode pembayaran", async () => {
    await act(async () => {
      root.render(
        <GatewayPayInstructions
          amount="Rp 11.100"
          vaNumber="FT123"
          methodType="RETAIL"
          onCopy={onCopy}
        />,
      );
    });

    expect(container.textContent).toContain("Kode Pembayaran");
    expect(container.textContent).toContain("Alfamart");
  });

  it("menggambar QRIS sebagai gambar yang bisa disimpan", async () => {
    await act(async () => {
      root.render(
        <GatewayPayInstructions
          amount="Rp 11.100"
          qrString="00020101021226610016ID.CO.SHOPEE.WWW"
          onCopy={onCopy}
        />,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(
      container.querySelector('a[download="qris-pembayaran.png"]'),
    ).not.toBeNull();
  });

  it("tanpa instruksi tidak menampilkan apa pun", async () => {
    await act(async () => {
      root.render(<GatewayPayInstructions amount="Rp 1" onCopy={onCopy} />);
    });

    expect(container.textContent).toBe("");
  });
});
