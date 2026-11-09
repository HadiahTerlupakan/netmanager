// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/inventory/PhotoUpload", () => ({
  PhotoUpload: () => <div>Unggah foto</div>,
}));

import { RestockPurchaseRecordModal } from "@/app/admin/inventory/restock/RestockPurchaseRecordModal";
import type { PurchaseFormLine } from "@/app/admin/inventory/restock/restockPurchaseForm";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";
import type { RestockPurchaseRecordState } from "@/app/admin/inventory/restock/useRestockPurchaseRecord";

const REQUEST = {
  id: "pr-1",
  nomorRequest: "PR-001",
} as PurchaseRequest;

const LINES: PurchaseFormLine[] = [
  {
    purchaseOrderItemId: "poi-1",
    nama: "Kabel Fiber",
    satuan: "roll",
    remainingToBuy: 6,
    isChecked: false,
    quantity: 6,
    unitPrice: "",
  },
  {
    purchaseOrderItemId: "poi-2",
    nama: "ONT",
    satuan: "pcs",
    remainingToBuy: 0,
    isChecked: false,
    quantity: 0,
    unitPrice: "",
  },
];

let container: HTMLDivElement;
let root: Root;

function makeState(
  overrides: Partial<RestockPurchaseRecordState> = {},
): RestockPurchaseRecordState {
  return {
    request: REQUEST,
    form: {
      storeName: "",
      purchasedAt: "2026-11-09",
      notes: "",
      buyerName: "",
      lines: LINES,
    },
    isSubmitting: false,
    problems: [],
    open: vi.fn(),
    close: vi.fn(),
    setStoreName: vi.fn(),
    setPurchasedAt: vi.fn(),
    setNotes: vi.fn(),
    setBuyerName: vi.fn(),
    toggleLine: vi.fn(),
    setLineQuantity: vi.fn(),
    setLinePrice: vi.fn(),
    selectAll: vi.fn(),
    submit: vi.fn().mockResolvedValue(undefined),
    photoUploadRef: { current: null },
    ...overrides,
  };
}

function render(
  state: RestockPurchaseRecordState,
  withTrigger = false,
  currentUserName: string | null = null,
) {
  act(() => {
    root.render(
      <>
        {withTrigger && <button type="button">Catat Belanja</button>}
        <RestockPurchaseRecordModal
          purchaseRecord={state}
          currentUserName={currentUserName}
        />
      </>,
    );
  });
}

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return button as HTMLButtonElement;
}

function findCheckbox(name: string): HTMLInputElement {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) => candidate.textContent === name,
  );
  const input = label && document.getElementById(label.htmlFor);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Centang "${name}" tidak ditemukan`);
  }
  return input;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("RestockPurchaseRecordModal", () => {
  it("memfokuskan nama toko saat dibuka dan mengembalikan fokus ke pemicu", () => {
    render(makeState({ request: null, form: null }), true);
    const trigger = findButton("Catat Belanja");
    trigger.focus();

    render(makeState(), true);
    expect(document.activeElement).toBe(
      document.querySelector('input[type="text"]'),
    );
    expect(
      document.querySelector<HTMLInputElement>('input[type="date"]')?.max,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    render(makeState({ request: null, form: null }), true);
    expect(document.activeElement).toBe(trigger);
  });

  it("menampilkan nama pembeli opsional dengan nama pengguna sebagai contoh", () => {
    const state = makeState();
    render(state, false, "Budi Admin");

    const label = Array.from(document.querySelectorAll("label")).find(
      (candidate) => candidate.textContent === "Nama pembeli (boleh kosong)",
    );
    const input = label && document.getElementById(label.htmlFor);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Isian nama pembeli tidak ditemukan");
    }
    expect(input.placeholder).toBe("Budi Admin");
    expect(input.required).toBe(false);

    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setValue?.call(input, "Andi");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(state.setBuyerName).toHaveBeenCalledWith("Andi");
  });

  it("mencentang semua barang lewat tombol cepat", () => {
    const state = makeState();
    render(state);

    act(() => findButton("Semua barang dibeli di toko ini").click());

    expect(state.selectAll).toHaveBeenCalled();
  });

  it("menonaktifkan barang yang sudah dibeli semua", () => {
    render(makeState());

    expect(findCheckbox("Kabel Fiber").disabled).toBe(false);
    expect(findCheckbox("ONT").disabled).toBe(true);
    expect(document.body.textContent).toContain("Belum dibeli 6 roll");
    expect(document.body.textContent).toContain("Sudah dibeli semua");
  });

  it("meneruskan centang barang", () => {
    const state = makeState();
    render(state);

    act(() => findCheckbox("Kabel Fiber").click());

    expect(state.toggleLine).toHaveBeenCalledWith("poi-1", true);
  });

  it("menampilkan masalah isian sebagai peringatan dan mengirim lewat Simpan Belanja", () => {
    const state = makeState({
      problems: ["Nama toko belum diisi. Tulis nama tokonya."],
    });
    render(state);

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      "Nama toko belum diisi. Tulis nama tokonya.",
    );

    act(() => findButton("Simpan Belanja").click());
    expect(state.submit).toHaveBeenCalled();
  });

  it("menunjukkan sedang menyimpan dan tidak memakai kata yang membingungkan", () => {
    render(makeState({ isSubmitting: true }));

    expect(findButton("Menyimpan...")).toBeTruthy();
    const text = document.body.textContent ?? "";
    for (const word of [
      /\bPO\b/,
      /supplier/i,
      /vendor/i,
      /verifikasi/i,
      /anulir/i,
    ]) {
      expect(text).not.toMatch(word);
    }
  });
});
