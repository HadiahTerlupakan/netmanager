// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerDialog } from "@/components/customer/CustomerDialog";
import { getButton, pressKey } from "../helpers/portal-dom";

const BOTTOM_NAV_Z_INDEX = 50;

function Harness({ onClose }: { onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => {
    onClose();
    setIsOpen(false);
  };
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Buka
      </button>
      {isOpen && (
        <CustomerDialog labelledBy="judul-uji" onClose={close}>
          <h2 id="judul-uji">Rincian Pembayaran</h2>
          <button type="button" aria-label="Tutup" onClick={close}>
            x
          </button>
          <input aria-label="Kode kupon" />
          <button type="button">Konfirmasi &amp; Bayar</button>
        </CustomerDialog>
      )}
    </div>
  );
}

/**
 * Lembar bayar dulu berupa div biasa: tanpa role dialog, Escape tidak
 * menutup, fokus tertinggal di halaman di belakangnya, dan lembar sukses
 * tertutup BottomNav sehingga tombolnya tidak bisa diketuk di HP.
 */
describe("CustomerDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();

  beforeEach(async () => {
    onClose.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness onClose={onClose} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function openFromTrigger() {
    const trigger = getButton("Buka", container);
    trigger.focus();
    await act(async () => trigger.click());
    return trigger;
  }

  function dialog() {
    return document.body.querySelector<HTMLElement>('[role="dialog"]');
  }

  it("diberi nama dari judulnya dan menandai dirinya modal", async () => {
    await openFromTrigger();

    const element = dialog();
    expect(element?.getAttribute("aria-modal")).toBe("true");
    const titleId = element?.getAttribute("aria-labelledby");
    expect(document.getElementById(titleId!)?.textContent).toBe(
      "Rincian Pembayaran",
    );
  });

  it("dirender di body, di atas lapisan BottomNav", async () => {
    await openFromTrigger();

    const overlay = dialog()?.parentElement;
    expect(container.contains(dialog())).toBe(false);
    const zIndex = Number(overlay?.className.match(/z-\[(\d+)\]/)?.[1]);
    expect(zIndex).toBeGreaterThan(BOTTOM_NAV_Z_INDEX);
  });

  it("memindahkan fokus ke dalam dialog saat dibuka", async () => {
    await openFromTrigger();

    expect(dialog()?.contains(document.activeElement)).toBe(true);
  });

  it("Escape menutup dialog dan fokus kembali ke tombol pembukanya", async () => {
    const trigger = await openFromTrigger();

    await pressKey("Escape");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab berputar di dalam dialog", async () => {
    await openFromTrigger();
    const close = getButton("Tutup");
    const confirm = getButton("Konfirmasi & Bayar");

    confirm.focus();
    await pressKey("Tab");
    expect(document.activeElement).toBe(close);

    await pressKey("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("mengetuk latar di luar lembar menutup dialog", async () => {
    await openFromTrigger();

    await act(async () => {
      dialog()?.parentElement?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
