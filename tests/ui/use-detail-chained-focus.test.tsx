// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDetailChainedFocus } from "@/app/admin/inventory/restock/useDetailChainedFocus";

/**
 * Tabel → detail → "Catat Barang Datang": detail tertutup bersamaan dengan
 * modal terima barang terbuka, jadi tombol pemicunya hilang dari halaman.
 */
function Harness() {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const { rememberDetailTrigger, markOpenedFromDetail } =
    useDetailChainedFocus(isPurchaseOpen);
  return (
    <div>
      <button
        type="button"
        id="row-detail"
        onClick={() => {
          rememberDetailTrigger();
          setIsDetailOpen(true);
        }}
      >
        Detail
      </button>
      {isDetailOpen && (
        <button
          type="button"
          id="detail-record"
          onClick={() => {
            markOpenedFromDetail();
            setIsDetailOpen(false);
            setIsPurchaseOpen(true);
          }}
        >
          Catat Barang Datang
        </button>
      )}
      {isPurchaseOpen && (
        <button
          type="button"
          id="purchase-close"
          onClick={() => setIsPurchaseOpen(false)}
        >
          Batal
        </button>
      )}
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

function click(id: string) {
  const button = document.getElementById(id) as HTMLButtonElement;
  button.focus();
  act(() => button.click());
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useDetailChainedFocus", () => {
  it("mengembalikan fokus ke tombol di tabel setelah modal lanjutan ditutup", () => {
    click("row-detail");
    click("detail-record");
    expect(document.getElementById("detail-record")).toBeNull();

    click("purchase-close");

    expect(document.activeElement?.id).toBe("row-detail");
  });
});
